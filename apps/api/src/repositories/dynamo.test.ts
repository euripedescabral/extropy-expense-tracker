import { describe, expect, it } from "vitest";
import { toPublicBudget, toPublicCategory, toPublicExpense } from "./dynamo";

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
});
