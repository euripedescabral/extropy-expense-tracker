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

export type DateRangePreset = "last7" | "last14" | "last30" | "currentMonth" | "lastMonth";

export type DateRange = {
  from: string;
  to: string;
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

export type FixedExpense = {
  id: string;
  userId: string;
  amountCents: number;
  description: string;
  categoryId: string;
};

export type FixedExpenseInput = {
  amount: string;
  description: string;
  categoryId: string;
};

export type FinancialGoal = {
  userId: string;
  monthlyExpenseLimitCents: number;
  monthlySavingsTargetCents: number;
};

export type FinancialGoalInput = {
  expenseLimit: string;
  savingsTarget: string;
};

export type BudgetSummary = Budget & {
  spentCents: number;
  remainingCents: number;
  percentageUsed: number;
  status: "under" | "near" | "over";
};

export type FinancialMood = {
  status: "confident" | "watchful" | "stressed";
  label: "Confident" | "Watchful" | "Stressed";
  message: string;
  monthlySpentCents: number;
  monthlyExpenseLimitCents: number;
  monthlySavingsTargetCents: number;
  remainingLimitCents: number;
  savingsBufferCents: number;
  limitUsedPercentage: number;
};

export type MonthlyTrend = {
  month: string;
  totalCents: number;
};

export type MonthlyGoalSpend = {
  variableExpenseCents: number;
  fixedExpenseCents: number;
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

export const fixedExpenseInputSchema = z.object({
  amount: z.string().min(1, "amount is required"),
  description: z.string().trim().min(1, "description is required").max(120),
  categoryId: z.string().trim().min(1, "categoryId is required")
});

export const financialGoalInputSchema = z.object({
  expenseLimit: z.string().min(1, "expenseLimit is required"),
  savingsTarget: z.string().min(1, "savingsTarget is required")
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

const parseDateOnly = (date: string) => {
  const parsed = dateSchema.safeParse(date);

  if (!parsed.success) {
    throw new Error("date range must use valid YYYY-MM-DD dates");
  }

  return new Date(`${date}T00:00:00.000Z`);
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
};

const startOfUtcMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfPreviousUtcMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0));

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

export const normalizeFixedExpenseInput = (input: FixedExpenseInput) => {
  const parsed = fixedExpenseInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid fixed expense");
  }

  return {
    amountCents: parseAmountCents(parsed.data.amount),
    description: parsed.data.description.trim(),
    categoryId: parsed.data.categoryId.trim()
  };
};

export const getDateRangeForPreset = (
  preset: DateRangePreset,
  referenceDate: string
): DateRange => {
  const today = parseDateOnly(referenceDate);

  if (preset === "last7") {
    return {
      from: formatDateOnly(addUtcDays(today, -6)),
      to: formatDateOnly(today)
    };
  }

  if (preset === "last14") {
    return {
      from: formatDateOnly(addUtcDays(today, -13)),
      to: formatDateOnly(today)
    };
  }

  if (preset === "last30") {
    return {
      from: formatDateOnly(addUtcDays(today, -29)),
      to: formatDateOnly(today)
    };
  }

  if (preset === "currentMonth") {
    return {
      from: formatDateOnly(startOfUtcMonth(today)),
      to: formatDateOnly(today)
    };
  }

  const lastMonthEnd = endOfPreviousUtcMonth(today);

  return {
    from: formatDateOnly(startOfUtcMonth(lastMonthEnd)),
    to: formatDateOnly(lastMonthEnd)
  };
};

export const normalizeCustomDateRange = (range: DateRange): DateRange => {
  const from = parseDateOnly(range.from);
  const to = parseDateOnly(range.to);

  if (from > to) {
    throw new Error("from date cannot be after to date");
  }

  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (days > 90) {
    throw new Error("custom date range cannot exceed 90 days");
  }

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to)
  };
};

export const normalizeFinancialGoalInput = (input: FinancialGoalInput) => {
  const parsed = financialGoalInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid financial goal");
  }

  try {
    const monthlyExpenseLimitCents = parseAmountCents(parsed.data.expenseLimit);
    const monthlySavingsTargetCents = parseAmountCents(parsed.data.savingsTarget);

    if (monthlySavingsTargetCents >= monthlyExpenseLimitCents) {
      throw new Error("saving target must be lower than expense limit");
    }

    return {
      monthlyExpenseLimitCents,
      monthlySavingsTargetCents
    };
  } catch {
    throw new Error("Invalid financial goal");
  }
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

export const getFinancialMood = (input: {
  monthlySpentCents: number;
  goal: FinancialGoal | null;
}): FinancialMood | null => {
  if (!input.goal) {
    return null;
  }

  const remainingLimitCents = input.goal.monthlyExpenseLimitCents - input.monthlySpentCents;
  const savingsBufferCents = remainingLimitCents - input.goal.monthlySavingsTargetCents;
  const limitUsedPercentage = roundPercentage(
    (input.monthlySpentCents / input.goal.monthlyExpenseLimitCents) * 100
  );

  if (remainingLimitCents < 0) {
    return {
      status: "stressed",
      label: "Stressed",
      message: "Spending is above the monthly expense limit.",
      monthlySpentCents: input.monthlySpentCents,
      monthlyExpenseLimitCents: input.goal.monthlyExpenseLimitCents,
      monthlySavingsTargetCents: input.goal.monthlySavingsTargetCents,
      remainingLimitCents,
      savingsBufferCents,
      limitUsedPercentage
    };
  }

  if (savingsBufferCents < 0) {
    return {
      status: "watchful",
      label: "Watchful",
      message: "Spending is inside the limit, but the saving target needs attention.",
      monthlySpentCents: input.monthlySpentCents,
      monthlyExpenseLimitCents: input.goal.monthlyExpenseLimitCents,
      monthlySavingsTargetCents: input.goal.monthlySavingsTargetCents,
      remainingLimitCents,
      savingsBufferCents,
      limitUsedPercentage
    };
  }

  return {
    status: "confident",
    label: "Confident",
    message: "Spending is below the limit and the saving target still fits.",
    monthlySpentCents: input.monthlySpentCents,
    monthlyExpenseLimitCents: input.goal.monthlyExpenseLimitCents,
    monthlySavingsTargetCents: input.goal.monthlySavingsTargetCents,
    remainingLimitCents,
    savingsBufferCents,
    limitUsedPercentage
  };
};

export const getMonthlyGoalSpend = (input: {
  expenses: readonly Expense[];
  fixedExpenses: readonly FixedExpense[];
  month: string;
}): MonthlyGoalSpend => {
  const variableExpenseCents = getMonthlyTotal(input.expenses, input.month);
  const fixedExpenseCents = input.fixedExpenses.reduce(
    (total, fixedExpense) => total + fixedExpense.amountCents,
    0
  );

  return {
    variableExpenseCents,
    fixedExpenseCents,
    totalCents: variableExpenseCents + fixedExpenseCents
  };
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
