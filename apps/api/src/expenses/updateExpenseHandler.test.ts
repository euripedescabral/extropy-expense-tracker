import { describe, expect, it, vi } from "vitest";
import { updateExpenseHandler } from "./updateExpenseHandler";

const event = {
  headers: { authorization: "Bearer valid.jwt" },
  pathParameters: { id: "exp_1" },
  body: JSON.stringify({
    amount: "18.25",
    description: "Coffee beans",
    categoryId: "food",
    occurredOn: "2026-06-15"
  })
};

describe("update expense handler", () => {
  it("requires authentication before updating an expense", async () => {
    const update = vi.fn();
    const handler = updateExpenseHandler({
      expenseRepository: { update },
      verifyToken: vi.fn()
    });

    const response = await handler({ ...event, headers: {} });

    expect(response.statusCode).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("validates and updates an expense scoped to the authenticated user", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "exp_1",
      userId: "user_1",
      amountCents: 1825,
      description: "Coffee beans",
      categoryId: "food",
      occurredOn: "2026-06-15"
    });
    const handler = updateExpenseHandler({
      expenseRepository: { update },
      verifyToken: vi.fn().mockReturnValue({ userId: "user_1" })
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      id: "exp_1",
      userId: "user_1",
      amountCents: 1825,
      description: "Coffee beans",
      categoryId: "food",
      occurredOn: "2026-06-15"
    });
    expect(JSON.parse(response.body)).toMatchObject({ description: "Coffee beans" });
  });

  it("returns 400 when the expense id is missing", async () => {
    const handler = updateExpenseHandler({
      expenseRepository: { update: vi.fn() },
      verifyToken: vi.fn().mockReturnValue({ userId: "user_1" })
    });

    const response = await handler({ ...event, pathParameters: {} });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: "Expense id is required" });
  });
});
