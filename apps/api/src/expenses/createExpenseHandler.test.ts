import { describe, expect, it, vi } from "vitest";
import { createExpenseHandler } from "./createExpenseHandler";

const baseEvent = {
  headers: {},
  requestContext: {},
  body: JSON.stringify({
    amount: "12.30",
    description: "Coffee",
    categoryId: "food",
    occurredOn: "2026-06-14"
  })
};

describe("create expense handler", () => {
  it("returns 401 when the request has no bearer token", async () => {
    const handler = createExpenseHandler({
      expenseRepository: { create: vi.fn() },
      verifyToken: vi.fn()
    });

    const response = await handler(baseEvent);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      error: "Authentication required"
    });
  });

  it("validates body, persists with authenticated user id, and returns 201", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "exp_1",
      userId: "user_1",
      amountCents: 1230,
      description: "Coffee",
      categoryId: "food",
      occurredOn: "2026-06-14"
    });
    const handler = createExpenseHandler({
      expenseRepository: { create },
      verifyToken: vi.fn().mockReturnValue({ userId: "user_1" })
    });

    const response = await handler({
      ...baseEvent,
      headers: { authorization: "Bearer valid.jwt" }
    });

    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith({
      userId: "user_1",
      amountCents: 1230,
      description: "Coffee",
      categoryId: "food",
      occurredOn: "2026-06-14"
    });
    expect(JSON.parse(response.body)).toMatchObject({ id: "exp_1" });
  });

  it("returns 400 with field errors for invalid expense input", async () => {
    const handler = createExpenseHandler({
      expenseRepository: { create: vi.fn() },
      verifyToken: vi.fn().mockReturnValue({ userId: "user_1" })
    });

    const response = await handler({
      ...baseEvent,
      headers: { authorization: "Bearer valid.jwt" },
      body: JSON.stringify({
        amount: "-1",
        description: "",
        categoryId: "",
        occurredOn: "yesterday"
      })
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Invalid expense",
      fields: expect.arrayContaining(["amount", "description", "categoryId", "occurredOn"])
    });
  });
});
