import { describe, expect, it } from "vitest";
import { toPublicBudget, toPublicCategory, toPublicExpense, toPublicFixedExpense, toPublicGoal } from "./dynamo";

describe("dynamo repository mappers", () => {
  it("removes storage keys from expense API records", () => {
    expect(
      toPublicExpense({
        pk: "USER#user_1",
        sk: "EXPENSE#expense_1",
        id: "expense_1",
        userId: "user_1",
        amountCents: 1230,
        description: "Coffee",
        categoryId: "food",
        occurredOn: "2026-06-14"
      } as never)
    ).toEqual({
      id: "expense_1",
      userId: "user_1",
      amountCents: 1230,
      description: "Coffee",
      categoryId: "food",
      occurredOn: "2026-06-14"
    });
  });

  it("removes storage keys from category API records", () => {
    expect(
      toPublicCategory({
        pk: "USER#user_1",
        sk: "CATEGORY#books",
        id: "books",
        userId: "user_1",
        name: "Books",
        kind: "custom"
      } as never)
    ).toEqual({
      id: "books",
      userId: "user_1",
      name: "Books",
      kind: "custom"
    });
  });

  it("removes storage keys from budget API records", () => {
    expect(
      toPublicBudget({
        pk: "USER#user_1",
        sk: "BUDGET#food",
        userId: "user_1",
        categoryId: "food",
        monthlyLimitCents: 50000
      } as never)
    ).toEqual({
      userId: "user_1",
      categoryId: "food",
      monthlyLimitCents: 50000
    });
  });

  it("removes storage keys from goal API records", () => {
    expect(
      toPublicGoal({
        pk: "USER#user_1",
        sk: "GOAL#MONTHLY",
        userId: "user_1",
        monthlyExpenseLimitCents: 200000,
        monthlySavingsTargetCents: 50000
      } as never)
    ).toEqual({
      userId: "user_1",
      monthlyExpenseLimitCents: 200000,
      monthlySavingsTargetCents: 50000
    });
  });

  it("removes storage keys from fixed expense API records", () => {
    expect(
      toPublicFixedExpense({
        pk: "USER#user_1",
        sk: "FIXED#fixed_1",
        id: "fixed_1",
        userId: "user_1",
        amountCents: 120000,
        description: "Rent",
        categoryId: "utilities"
      } as never)
    ).toEqual({
      id: "fixed_1",
      userId: "user_1",
      amountCents: 120000,
      description: "Rent",
      categoryId: "utilities"
    });
  });
});
