import { describe, expect, it } from "vitest";
import {
  filterExpenses,
  getCategoryBreakdown,
  getMonthlyTotal,
  normalizeExpenseInput
} from "./reports";

const expenses = [
  {
    id: "exp_1",
    userId: "user_1",
    amountCents: 1299,
    description: "Lunch",
    categoryId: "food",
    occurredOn: "2026-06-01"
  },
  {
    id: "exp_2",
    userId: "user_1",
    amountCents: 4500,
    description: "Uber",
    categoryId: "transport",
    occurredOn: "2026-06-02"
  },
  {
    id: "exp_3",
    userId: "user_1",
    amountCents: 1999,
    description: "Cinema",
    categoryId: "entertainment",
    occurredOn: "2026-05-29"
  }
] as const;

describe("expense reporting", () => {
  it("normalizes decimal amount input into cents without floating point drift", () => {
    expect(
      normalizeExpenseInput({
        amount: "12.30",
        description: "Coffee",
        categoryId: "food",
        occurredOn: "2026-06-14"
      })
    ).toEqual({
      amountCents: 1230,
      description: "Coffee",
      categoryId: "food",
      occurredOn: "2026-06-14"
    });
  });

  it("rejects empty descriptions, invalid dates, and non-positive amounts", () => {
    expect(() =>
      normalizeExpenseInput({
        amount: "0",
        description: "",
        categoryId: "food",
        occurredOn: "not-a-date"
      })
    ).toThrow(/amount|description|date/i);
  });

  it("filters by inclusive date range and category without mutating the source list", () => {
    const result = filterExpenses(expenses, {
      from: "2026-06-01",
      to: "2026-06-30",
      categoryId: "transport"
    });

    expect(result).toEqual([expenses[1]]);
    expect(expenses).toHaveLength(3);
  });

  it("computes monthly totals in cents for a requested YYYY-MM month", () => {
    expect(getMonthlyTotal(expenses, "2026-06")).toBe(5799);
  });

  it("returns category breakdown sorted by highest spending first", () => {
    expect(getCategoryBreakdown(expenses)).toEqual([
      { categoryId: "transport", totalCents: 4500, percentage: 57.71 },
      { categoryId: "entertainment", totalCents: 1999, percentage: 25.63 },
      { categoryId: "food", totalCents: 1299, percentage: 16.66 }
    ]);
  });
});
