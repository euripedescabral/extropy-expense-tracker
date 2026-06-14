import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import type { Budget, Category, Expense } from "@expense-tracker/core";
import { createAppHandler } from "./lambda";

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

const event = (
  method: string,
  rawPath: string,
  input?: {
    token?: string;
    body?: unknown;
  }
) =>
  ({
    rawPath,
    headers: input?.token ? { authorization: `Bearer ${input.token}` } : {},
    body: input?.body ? JSON.stringify(input.body) : undefined,
    requestContext: {
      http: {
        method
      }
    }
  }) as APIGatewayProxyEventV2;

const bodyOf = <T>(response: { body: string }) => JSON.parse(response.body) as T;

const buildHandler = () => {
  const users: UserRecord[] = [];
  const expenses: Expense[] = [];
  const categories: Category[] = [];
  const budgets: Budget[] = [];

  return createAppHandler({
    jwtSecret: "test-secret",
    userRepository: {
      findByEmail: vi.fn(async (email: string) => users.find((user) => user.email === email) ?? null),
      createUser: vi.fn(async (input: { email: string; passwordHash: string }) => {
        const user = {
          id: "user_1",
          email: input.email,
          passwordHash: input.passwordHash
        };
        users.push(user);

        return user;
      })
    },
    expenseRepository: {
      list: vi.fn(async () => expenses),
      create: vi.fn(async (input: Omit<Expense, "id">) => {
        const expense = {
          id: "expense_1",
          ...input
        };
        expenses.push(expense);

        return expense;
      }),
      update: vi.fn(async (input: Expense) => {
        const index = expenses.findIndex((expense) => expense.id === input.id);
        expenses[index] = input;

        return input;
      }),
      delete: vi.fn(async (input: { id: string }) => {
        const index = expenses.findIndex((expense) => expense.id === input.id);

        if (index >= 0) {
          expenses.splice(index, 1);
        }
      })
    },
    categoryRepository: {
      list: vi.fn(async (userId: string) => [
        { id: "food", userId, name: "Food", kind: "system" as const },
        ...categories
      ]),
      create: vi.fn(async (category: Category) => {
        categories.push(category);

        return category;
      })
    },
    budgetRepository: {
      list: vi.fn(async () => budgets),
      upsert: vi.fn(async (budget: Budget) => {
        const index = budgets.findIndex((item) => item.categoryId === budget.categoryId);
        if (index >= 0) {
          budgets[index] = budget;
        } else {
          budgets.push(budget);
        }

        return budget;
      })
    }
  });
};

describe("lambda app handler", () => {
  it("runs the authenticated expense tracker API flow", async () => {
    const handler = buildHandler();

    const signup = await handler(
      event("POST", "/auth/signup", {
        body: { email: "Ada@Example.com", password: "CorrectHorse123!" }
      })
    );

    expect(signup.statusCode).toBe(201);
    const session = bodyOf<{ token: string; user: { email: string } }>(signup);
    expect(session.user.email).toBe("ada@example.com");

    const categories = await handler(event("GET", "/categories", { token: session.token }));
    expect(categories.statusCode).toBe(200);
    expect(bodyOf<Category[]>(categories)).toContainEqual(
      expect.objectContaining({ id: "food", name: "Food" })
    );

    const customCategory = await handler(
      event("POST", "/categories", {
        token: session.token,
        body: { name: "Books" }
      })
    );
    expect(customCategory.statusCode).toBe(201);
    expect(bodyOf<Category>(customCategory)).toMatchObject({ id: "books", name: "Books" });

    const savedBudget = await handler(
      event("PUT", "/budgets/food", {
        token: session.token,
        body: { amount: "200.00" }
      })
    );
    expect(savedBudget.statusCode).toBe(200);
    expect(bodyOf<Budget>(savedBudget)).toEqual({
      userId: "user_1",
      categoryId: "food",
      monthlyLimitCents: 20000
    });

    const listBudgets = await handler(event("GET", "/budgets", { token: session.token }));
    expect(listBudgets.statusCode).toBe(200);
    expect(bodyOf<Budget[]>(listBudgets)).toContainEqual(
      expect.objectContaining({ categoryId: "food", monthlyLimitCents: 20000 })
    );

    const createdExpense = await handler(
      event("POST", "/expenses", {
        token: session.token,
        body: {
          amount: "12.30",
          description: "Coffee",
          categoryId: "food",
          occurredOn: "2026-06-14"
        }
      })
    );
    expect(createdExpense.statusCode).toBe(201);
    expect(bodyOf<Expense>(createdExpense)).toMatchObject({
      amountCents: 1230,
      description: "Coffee"
    });

    const updatedExpense = await handler(
      event("PUT", "/expenses/expense_1", {
        token: session.token,
        body: {
          amount: "18.00",
          description: "Coffee beans",
          categoryId: "food",
          occurredOn: "2026-06-15"
        }
      })
    );
    expect(updatedExpense.statusCode).toBe(200);
    expect(bodyOf<Expense>(updatedExpense)).toMatchObject({
      amountCents: 1800,
      description: "Coffee beans"
    });

    const listExpenses = await handler(event("GET", "/expenses", { token: session.token }));
    expect(bodyOf<Expense[]>(listExpenses)).toHaveLength(1);

    const deletedExpense = await handler(event("DELETE", "/expenses/expense_1", { token: session.token }));
    expect(deletedExpense.statusCode).toBe(204);

    const emptyExpenses = await handler(event("GET", "/expenses", { token: session.token }));
    expect(bodyOf<Expense[]>(emptyExpenses)).toEqual([]);
  });

  it("rejects unauthenticated private routes", async () => {
    const handler = buildHandler();

    const response = await handler(event("GET", "/expenses"));

    expect(response.statusCode).toBe(401);
    expect(bodyOf(response)).toEqual({ error: "Authentication required" });
  });
});
