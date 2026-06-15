import { describe, expect, it } from "vitest";
import {
  buildExpenseCsv,
  getDateRangeForPreset,
  getFinancialMood,
  getMonthlyGoalSpend,
  filterExpenses,
  getBudgetSummaries,
  getCategoryBreakdown,
  getMonthlyTotal,
  getMonthlyTrends,
  normalizeCustomDateRange,
  normalizeFinancialGoalInput,
  normalizeFixedExpenseInput,
  normalizeBudgetInput,
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

  it("normalizes fixed monthly expenses and counts them toward goal spend", () => {
    expect(
      normalizeFixedExpenseInput({
        amount: "1200.00",
        description: "Rent",
        categoryId: "utilities"
      })
    ).toEqual({
      amountCents: 120000,
      description: "Rent",
      categoryId: "utilities"
    });

    expect(
      getMonthlyGoalSpend({
        expenses,
        fixedExpenses: [
          {
            id: "fixed_1",
            userId: "user_1",
            amountCents: 120000,
            description: "Rent",
            categoryId: "utilities"
          }
        ],
        month: "2026-06"
      })
    ).toEqual({
      variableExpenseCents: 5799,
      fixedExpenseCents: 120000,
      totalCents: 125799
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

  it("builds useful period preset ranges from a reference date", () => {
    expect(getDateRangeForPreset("last7", "2026-06-15")).toEqual({
      from: "2026-06-09",
      to: "2026-06-15"
    });
    expect(getDateRangeForPreset("last14", "2026-06-15")).toEqual({
      from: "2026-06-02",
      to: "2026-06-15"
    });
    expect(getDateRangeForPreset("currentMonth", "2026-06-15")).toEqual({
      from: "2026-06-01",
      to: "2026-06-15"
    });
    expect(getDateRangeForPreset("lastMonth", "2026-06-15")).toEqual({
      from: "2026-05-01",
      to: "2026-05-31"
    });
  });

  it("allows custom date ranges up to 90 days and rejects wider windows", () => {
    expect(normalizeCustomDateRange({ from: "2026-04-02", to: "2026-06-30" })).toEqual({
      from: "2026-04-02",
      to: "2026-06-30"
    });

    expect(() => normalizeCustomDateRange({ from: "2026-03-01", to: "2026-06-30" })).toThrow(/90 days/i);
    expect(() => normalizeCustomDateRange({ from: "2026-06-30", to: "2026-06-01" })).toThrow(/after/i);
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

  it("normalizes budget input and rejects invalid budget values", () => {
    expect(normalizeBudgetInput({ categoryId: "food", amount: "250.50" })).toEqual({
      categoryId: "food",
      monthlyLimitCents: 25050
    });

    expect(() => normalizeBudgetInput({ categoryId: "", amount: "0" })).toThrow(/budget/i);
  });

  it("normalizes financial goal input for monthly expense and saving targets", () => {
    expect(normalizeFinancialGoalInput({ expenseLimit: "2000.00", savingsTarget: "500.00" })).toEqual({
      monthlyExpenseLimitCents: 200000,
      monthlySavingsTargetCents: 50000
    });

    expect(() => normalizeFinancialGoalInput({ expenseLimit: "0", savingsTarget: "500.00" })).toThrow(/goal/i);
  });

  it("generates a confident mood when spending leaves room for the saving target", () => {
    expect(
      getFinancialMood({
        monthlySpentCents: 5799,
        goal: {
          userId: "user_1",
          monthlyExpenseLimitCents: 200000,
          monthlySavingsTargetCents: 50000
        }
      })
    ).toEqual({
      status: "confident",
      label: "Confident",
      message: "Spending is below the limit and the saving target still fits.",
      monthlySpentCents: 5799,
      monthlyExpenseLimitCents: 200000,
      monthlySavingsTargetCents: 50000,
      remainingLimitCents: 194201,
      savingsBufferCents: 144201,
      limitUsedPercentage: 2.9
    });
  });

  it("generates watchful and stressed moods when goals are at risk", () => {
    expect(
      getFinancialMood({
        monthlySpentCents: 180000,
        goal: {
          userId: "user_1",
          monthlyExpenseLimitCents: 200000,
          monthlySavingsTargetCents: 50000
        }
      })?.status
    ).toBe("watchful");

    expect(
      getFinancialMood({
        monthlySpentCents: 225000,
        goal: {
          userId: "user_1",
          monthlyExpenseLimitCents: 200000,
          monthlySavingsTargetCents: 50000
        }
      })?.status
    ).toBe("stressed");
  });

  it("summarizes category budgets against monthly spending", () => {
    expect(
      getBudgetSummaries({
        expenses,
        budgets: [
          { userId: "user_1", categoryId: "food", monthlyLimitCents: 5000 },
          { userId: "user_1", categoryId: "transport", monthlyLimitCents: 4000 }
        ],
        month: "2026-06"
      })
    ).toEqual([
      {
        userId: "user_1",
        categoryId: "transport",
        monthlyLimitCents: 4000,
        spentCents: 4500,
        remainingCents: -500,
        percentageUsed: 112.5,
        status: "over"
      },
      {
        userId: "user_1",
        categoryId: "food",
        monthlyLimitCents: 5000,
        spentCents: 1299,
        remainingCents: 3701,
        percentageUsed: 25.98,
        status: "under"
      }
    ]);
  });

  it("builds monthly spending trends sorted by month", () => {
    expect(getMonthlyTrends(expenses)).toEqual([
      { month: "2026-05", totalCents: 1999 },
      { month: "2026-06", totalCents: 5799 }
    ]);
  });

  it("exports expenses as csv with escaped values and category names", () => {
    expect(
      buildExpenseCsv([
        {
          id: "exp_csv",
          userId: "user_1",
          amountCents: 1299,
          description: "Lunch, with team",
          categoryId: "food",
          occurredOn: "2026-06-01"
        }
      ], {
        food: "Food"
      })
    ).toBe('Date,Description,Category,Amount\n2026-06-01,"Lunch, with team",Food,12.99');
  });
});
