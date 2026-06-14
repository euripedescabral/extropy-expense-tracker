import { z } from "zod";

export type Expense = {
  id: string;
  userId: string;
  amountCents: number;
  description: string;
  categoryId: string;
  occurredOn: string;
};

export type ExpenseInput = {
  amount: string;
  description: string;
  categoryId: string;
  occurredOn: string;
};

export type ExpenseFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
};

export type Budget = {
  userId: string;
  categoryId: string;
  monthlyLimitCents: number;
};

export type BudgetInput = {
  categoryId: string;
  amount: string;
};

export type BudgetSummary = Budget & {
  spentCents: number;
  remainingCents: number;
  percentageUsed: number;
  status: "under" | "near" | "over";
};

export type MonthlyTrend = {
  month: string;
  totalCents: number;
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "date must be valid");

export const expenseInputSchema = z.object({
  amount: z.string().min(1, "amount is required"),
  description: z.string().trim().min(1, "description is required").max(120),
  categoryId: z.string().trim().min(1, "categoryId is required"),
  occurredOn: dateSchema
});

export const normalizedExpenseSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  categoryId: z.string().min(1),
  occurredOn: dateSchema
});

export const budgetInputSchema = z.object({
  categoryId: z.string().trim().min(1, "categoryId is required"),
  amount: z.string().min(1, "amount is required")
});

const parseAmountCents = (amount: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("amount must be a positive decimal with up to two cents");
  }

  const [dollars, cents = ""] = amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));

  if (amountCents <= 0) {
    throw new Error("amount must be greater than zero");
  }

  return amountCents;
};

const roundPercentage = (value: number) => Math.round(value * 100) / 100;

export const normalizeExpenseInput = (input: ExpenseInput) => {
  const parsed = expenseInputSchema.safeParse(input);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid expense: ${fields}`);
  }

  return {
    amountCents: parseAmountCents(parsed.data.amount),
    description: parsed.data.description.trim(),
    categoryId: parsed.data.categoryId.trim(),
    occurredOn: parsed.data.occurredOn
  };
};

export const normalizeBudgetInput = (input: BudgetInput) => {
  const parsed = budgetInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid budget");
  }

  return {
    categoryId: parsed.data.categoryId.trim(),
    monthlyLimitCents: parseAmountCents(parsed.data.amount)
  };
};

export const filterExpenses = (expenses: readonly Expense[], filters: ExpenseFilters) =>
  expenses.filter((expense) => {
    const matchesFrom = filters.from ? expense.occurredOn >= filters.from : true;
    const matchesTo = filters.to ? expense.occurredOn <= filters.to : true;
    const matchesCategory = filters.categoryId ? expense.categoryId === filters.categoryId : true;

    return matchesFrom && matchesTo && matchesCategory;
  });

export const getMonthlyTotal = (expenses: readonly Expense[], month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must use YYYY-MM");
  }

  return expenses
    .filter((expense) => expense.occurredOn.startsWith(month))
    .reduce((total, expense) => total + expense.amountCents, 0);
};

export const getCategoryBreakdown = (expenses: readonly Expense[]) => {
  const total = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const byCategory = expenses.reduce<Record<string, number>>(
    (accumulator, expense) => ({
      ...accumulator,
      [expense.categoryId]: (accumulator[expense.categoryId] ?? 0) + expense.amountCents
    }),
    {}
  );

  return Object.entries(byCategory)
    .map(([categoryId, totalCents]) => ({
      categoryId,
      totalCents,
      percentage: total === 0 ? 0 : Math.round((totalCents / total) * 10000) / 100
    }))
    .sort((left, right) => right.totalCents - left.totalCents);
};

export const getBudgetSummaries = (input: {
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  month: string;
}): BudgetSummary[] => {
  const monthExpenses = input.expenses.filter((expense) => expense.occurredOn.startsWith(input.month));

  return input.budgets
    .map((budget) => {
      const spentCents = monthExpenses
        .filter((expense) => expense.categoryId === budget.categoryId)
        .reduce((total, expense) => total + expense.amountCents, 0);
      const percentageUsed = roundPercentage((spentCents / budget.monthlyLimitCents) * 100);

      return {
        ...budget,
        spentCents,
        remainingCents: budget.monthlyLimitCents - spentCents,
        percentageUsed,
        status: (percentageUsed >= 100 ? "over" : percentageUsed >= 80 ? "near" : "under") as
          | "under"
          | "near"
          | "over"
      };
    })
    .sort((left, right) => right.percentageUsed - left.percentageUsed);
};

export const getMonthlyTrends = (expenses: readonly Expense[]): MonthlyTrend[] => {
  const byMonth = expenses.reduce<Record<string, number>>(
    (accumulator, expense) => ({
      ...accumulator,
      [expense.occurredOn.slice(0, 7)]:
        (accumulator[expense.occurredOn.slice(0, 7)] ?? 0) + expense.amountCents
    }),
    {}
  );

  return Object.entries(byMonth)
    .map(([month, totalCents]) => ({ month, totalCents }))
    .sort((left, right) => left.month.localeCompare(right.month));
};

const escapeCsv = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;

export const buildExpenseCsv = (
  expenses: readonly Expense[],
  categoryNameById: Record<string, string>
) => [
  "Date,Description,Category,Amount",
  ...expenses.map((expense) =>
    [
      expense.occurredOn,
      escapeCsv(expense.description),
      escapeCsv(categoryNameById[expense.categoryId] ?? expense.categoryId),
      (expense.amountCents / 100).toFixed(2)
    ].join(",")
  )
].join("\n");
