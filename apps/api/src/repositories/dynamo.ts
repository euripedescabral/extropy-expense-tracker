import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import {
  seedDefaultCategories,
  type Budget,
  type Category,
  type Expense,
  type FinancialGoal,
  type FixedExpense
} from "@expense-tracker/core";

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

type DynamoRepositoriesInput = {
  tableName: string;
  documentClient?: DynamoDBDocumentClient;
};

const userPk = (email: string) => `USER_EMAIL#${email}`;
const userSk = "PROFILE";
const accountPk = (userId: string) => `USER#${userId}`;
const expenseSk = (id: string) => `EXPENSE#${id}`;
const categorySk = (id: string) => `CATEGORY#${id}`;
const budgetSk = (categoryId: string) => `BUDGET#${categoryId}`;
const fixedExpenseSk = (id: string) => `FIXED#${id}`;
const goalSk = "GOAL#MONTHLY";

export const toPublicExpense = (item: Expense): Expense => ({
  id: item.id,
  userId: item.userId,
  amountCents: item.amountCents,
  description: item.description,
  categoryId: item.categoryId,
  occurredOn: item.occurredOn
});

export const toPublicCategory = (item: Category): Category => ({
  id: item.id,
  userId: item.userId,
  name: item.name,
  kind: item.kind
});

export const toPublicBudget = (item: Budget): Budget => ({
  userId: item.userId,
  categoryId: item.categoryId,
  monthlyLimitCents: item.monthlyLimitCents
});

export const toPublicGoal = (item: FinancialGoal): FinancialGoal => ({
  userId: item.userId,
  monthlyExpenseLimitCents: item.monthlyExpenseLimitCents,
  monthlySavingsTargetCents: item.monthlySavingsTargetCents
});

export const toPublicFixedExpense = (item: FixedExpense): FixedExpense => ({
  id: item.id,
  userId: item.userId,
  amountCents: item.amountCents,
  description: item.description,
  categoryId: item.categoryId
});

export const createDynamoRepositories = (input: DynamoRepositoriesInput) => {
  const documentClient =
    input.documentClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const getItem = async <T>(key: { pk: string; sk: string }) => {
    const result = await documentClient.send(
      new GetCommand({
        TableName: input.tableName,
        Key: key
      })
    );

    return (result.Item as T | undefined) ?? null;
  };

  const putItem = async (item: Record<string, unknown>, conditionExpression?: string) => {
    await documentClient.send(
      new PutCommand({
        TableName: input.tableName,
        Item: item,
        ConditionExpression: conditionExpression
      })
    );
  };

  const queryUserItems = async <T>(userId: string, sortKeyPrefix: string) => {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: input.tableName,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": accountPk(userId),
          ":sk": sortKeyPrefix
        }
      })
    );

    return (result.Items ?? []) as T[];
  };

  return {
    users: {
      findByEmail: async (email: string) =>
        getItem<UserRecord>({
          pk: userPk(email),
          sk: userSk
        }),
      createUser: async (userInput: { email: string; passwordHash: string }) => {
        const id: string = randomUUID();
        const user = {
          id,
          email: userInput.email,
          passwordHash: userInput.passwordHash
        };

        await putItem({
          pk: userPk(user.email),
          sk: userSk,
          ...user
        }, "attribute_not_exists(pk)");

        return user;
      }
    },
    expenses: {
      list: async (userId: string) =>
        queryUserItems<Expense>(userId, "EXPENSE#").then((expenses) =>
          expenses
            .map(toPublicExpense)
            .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn))
        ),
      create: async (expenseInput: Omit<Expense, "id">) => {
        const id: string = randomUUID();
        const expense = {
          id,
          ...expenseInput
        };

        await putItem({
          pk: accountPk(expense.userId),
          sk: expenseSk(expense.id),
          ...expense
        }, "attribute_not_exists(pk)");

        return expense;
      },
      update: async (expense: Expense) => {
        await putItem({
          pk: accountPk(expense.userId),
          sk: expenseSk(expense.id),
          ...expense
        }, "attribute_exists(pk)");

        return expense;
      },
      delete: async (deleteInput: { userId: string; id: string }) => {
        await documentClient.send(
          new DeleteCommand({
            TableName: input.tableName,
            Key: {
              pk: accountPk(deleteInput.userId),
              sk: expenseSk(deleteInput.id)
            }
          })
        );
      }
    },
    categories: {
      list: async (userId: string) => [
        ...seedDefaultCategories(userId),
        ...(await queryUserItems<Category>(userId, "CATEGORY#")).map(toPublicCategory)
      ],
      create: async (category: Category) => {
        await putItem({
          pk: accountPk(category.userId),
          sk: categorySk(category.id),
          ...category
        }, "attribute_not_exists(pk)");

        return category;
      }
    },
    budgets: {
      list: async (userId: string) =>
        queryUserItems<Budget>(userId, "BUDGET#").then((budgets) =>
          budgets.map(toPublicBudget).sort((left, right) => left.categoryId.localeCompare(right.categoryId))
        ),
      upsert: async (budget: Budget) => {
        await putItem({
          pk: accountPk(budget.userId),
          sk: budgetSk(budget.categoryId),
          ...budget
        });

        return budget;
      }
    },
    goals: {
      get: async (userId: string) => {
        const goal = await getItem<FinancialGoal>({
          pk: accountPk(userId),
          sk: goalSk
        });

        return goal ? toPublicGoal(goal) : null;
      },
      upsert: async (goal: FinancialGoal) => {
        await putItem({
          pk: accountPk(goal.userId),
          sk: goalSk,
          ...goal
        });

        return goal;
      }
    },
    fixedExpenses: {
      list: async (userId: string) =>
        queryUserItems<FixedExpense>(userId, "FIXED#").then((fixedExpenses) =>
          fixedExpenses
            .map(toPublicFixedExpense)
            .sort((left, right) => left.description.localeCompare(right.description))
        ),
      create: async (fixedExpenseInput: Omit<FixedExpense, "id">) => {
        const id: string = randomUUID();
        const fixedExpense = {
          id,
          ...fixedExpenseInput
        };

        await putItem({
          pk: accountPk(fixedExpense.userId),
          sk: fixedExpenseSk(fixedExpense.id),
          ...fixedExpense
        }, "attribute_not_exists(pk)");

        return fixedExpense;
      },
      delete: async (deleteInput: { userId: string; id: string }) => {
        await documentClient.send(
          new DeleteCommand({
            TableName: input.tableName,
            Key: {
              pk: accountPk(deleteInput.userId),
              sk: fixedExpenseSk(deleteInput.id)
            }
          })
        );
      }
    }
  };
};
