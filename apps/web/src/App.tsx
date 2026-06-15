import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BarChart3,
  Download,
  Edit3,
  Gauge,
  LoaderCircle,
  LogIn,
  PiggyBank,
  Plus,
  Save,
  SearchX,
  Target,
  Trash2,
  UserPlus
} from "lucide-react";
import {
  buildExpenseCsv,
  getDateRangeForPreset,
  filterExpenses,
  getFinancialMood,
  getMonthlyGoalSpend,
  getBudgetSummaries,
  getCategoryBreakdown,
  getMonthlyTrends,
  normalizeFinancialGoalInput,
  normalizeCustomDateRange,
  normalizeFixedExpenseInput,
  normalizeBudgetInput,
  type Budget,
  type DateRangePreset,
  type Expense,
  type FinancialGoal,
  type FixedExpense
} from "@expense-tracker/core";
import { formatMoneyInputValue, normalizeMoneyInputValue } from "./features/forms/moneyInput";
import { buildReportViewModel } from "./features/expenses/reportViewModel";
import "./styles.css";

type Category = {
  id: string;
  name: string;
  kind: "system" | "custom";
};

type User = {
  id: string;
  email: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";
const todayDate = new Date().toISOString().slice(0, 10);
const defaultDateRange = getDateRangeForPreset("currentMonth", todayDate);

const authHeaders = (token: string) => ({
  "content-type": "application/json",
  authorization: `Bearer ${token}`
});

const formatCents = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);

const readJson = async <T,>(response: Response): Promise<T> => {
  const body = (await response.json()) as T;

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return body;
};

const SkeletonRows = ({ count }: { count: number }) => (
  <div className="skeleton-stack" data-testid="dashboard-skeleton" aria-label="Loading dashboard">
    {Array.from({ length: count }, (_, index) => (
      <span key={index} className="skeleton-row" />
    ))}
  </div>
);

const normalizeCentsForInput = (amountCents: number) => (amountCents / 100).toFixed(2);

export const App = () => {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [activeView, setActiveView] = useState<"dashboard" | "report">("dashboard");
  const [periodPreset, setPeriodPreset] = useState<DateRangePreset | "custom">("currentMonth");
  const [filterCategory, setFilterCategory] = useState("");
  const [fromDate, setFromDate] = useState(defaultDateRange.from);
  const [toDate, setToDate] = useState(defaultDateRange.to);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: ""
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    categoryId: "food",
    occurredOn: new Date().toISOString().slice(0, 10)
  });
  const [newCategory, setNewCategory] = useState("");
  const [budgetForm, setBudgetForm] = useState({
    categoryId: "food",
    amount: ""
  });
  const [goalForm, setGoalForm] = useState({
    expenseLimit: "",
    savingsTarget: ""
  });
  const [fixedExpenseForm, setFixedExpenseForm] = useState({
    amount: "",
    description: "",
    categoryId: "food"
  });
  const [authLoading, setAuthLoading] = useState<"login" | "signup" | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [fixedExpenseSaving, setFixedExpenseSaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingFixedExpenseId, setDeletingFixedExpenseId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const hasActiveFilters = Boolean(filterCategory || periodPreset !== "currentMonth");
  const canSubmitExpense =
    Boolean(expenseForm.amount.trim()) &&
    Boolean(expenseForm.description.trim()) &&
    Boolean(expenseForm.categoryId) &&
    Boolean(expenseForm.occurredOn) &&
    !expenseSaving &&
    !isLoadingDashboard;
  const canAddCategory = Boolean(newCategory.trim()) && !categorySaving && !isLoadingDashboard;
  const canSaveBudget = Boolean(budgetForm.categoryId) && Boolean(budgetForm.amount.trim()) && !budgetSaving;
  const canSaveGoals =
    Boolean(goalForm.expenseLimit.trim()) &&
    Boolean(goalForm.savingsTarget.trim()) &&
    !goalSaving &&
    !isLoadingDashboard;
  const canAddFixedExpense =
    Boolean(fixedExpenseForm.amount.trim()) &&
    Boolean(fixedExpenseForm.description.trim()) &&
    Boolean(fixedExpenseForm.categoryId) &&
    !fixedExpenseSaving &&
    !isLoadingDashboard;

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoadingDashboard(true);
    setStatusMessage("Loading dashboard");
    void Promise.all([
      fetch(`${apiBaseUrl}/categories`, { headers: authHeaders(token) }).then((response) =>
        readJson<Category[]>(response)
      ),
      fetch(`${apiBaseUrl}/expenses`, { headers: authHeaders(token) }).then((response) =>
        readJson<Expense[]>(response)
      ),
      fetch(`${apiBaseUrl}/budgets`, { headers: authHeaders(token) }).then((response) =>
        readJson<Budget[]>(response)
      ),
      fetch(`${apiBaseUrl}/goals`, { headers: authHeaders(token) }).then((response) =>
        readJson<FinancialGoal | null>(response)
      ),
      fetch(`${apiBaseUrl}/fixed-expenses`, { headers: authHeaders(token) }).then((response) =>
        readJson<FixedExpense[]>(response)
      )
    ]).then((
      [nextCategories, nextExpenses, nextBudgets, nextGoal, nextFixedExpenses]: [
        Category[],
        Expense[],
        Budget[],
        FinancialGoal | null,
        FixedExpense[]
      ]
    ) => {
      setCategories(nextCategories);
      setExpenses(nextExpenses);
      setBudgets(nextBudgets);
      setGoal(nextGoal);
      setFixedExpenses(nextFixedExpenses);
      setExpenseForm((current) => ({
        ...current,
        categoryId: nextCategories[0]?.id ?? ""
      }));
      setBudgetForm((current) => ({
        ...current,
        categoryId: nextCategories[0]?.id ?? ""
      }));
      setGoalForm({
        expenseLimit: nextGoal ? normalizeCentsForInput(nextGoal.monthlyExpenseLimitCents) : "",
        savingsTarget: nextGoal ? normalizeCentsForInput(nextGoal.monthlySavingsTargetCents) : ""
      });
      setFixedExpenseForm((current) => ({
        ...current,
        categoryId: nextCategories[0]?.id ?? ""
      }));
      setStatusMessage("");
    }).catch(() => {
      setStatusMessage("Unable to load dashboard data.");
    }).finally(() => {
      setIsLoadingDashboard(false);
    });
  }, [token]);

  const visibleExpenses = useMemo(
    () =>
      filterExpenses(expenses, {
        categoryId: filterCategory || undefined,
        from: fromDate || undefined,
        to: toDate || undefined
      }),
    [expenses, filterCategory, fromDate, toDate]
  );

  const categoryNameById = useMemo(
    () =>
      Object.fromEntries(categories.map((category) => [category.id, category.name] as const)),
    [categories]
  );

  const visibleTotalCents = visibleExpenses.reduce((total, expense) => total + expense.amountCents, 0);
  const breakdown = getCategoryBreakdown(visibleExpenses).map((item) => ({
    ...item,
    categoryName: categoryNameById[item.categoryId] ?? item.categoryId
  }));
  const topCategory = breakdown[0]?.categoryName ?? "No spend yet";
  const budgetSummaries = getBudgetSummaries({
    expenses,
    budgets,
    month: "2026-06"
  }).map((item) => ({
    ...item,
    categoryName: categoryNameById[item.categoryId] ?? item.categoryId
  }));
  const trends = getMonthlyTrends(expenses);
  const maxTrendCents = Math.max(...trends.map((trend) => trend.totalCents), 1);
  const goalSpend = getMonthlyGoalSpend({
    expenses: visibleExpenses,
    fixedExpenses,
    month: "2026-06"
  });
  const financialMood = getFinancialMood({
    monthlySpentCents: goalSpend.totalCents,
    goal
  });
  const report = buildReportViewModel({
    monthlyTotalCents: visibleTotalCents,
    breakdown,
    locale: "en-US",
    currency: "USD"
  });

  const authenticate = async (mode: "login" | "signup") => {
    setAuthLoading(mode);
    setStatusMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const body = await readJson<{ token: string; user: User }>(response);

      setToken(body.token);
      setUser(body.user);
    } catch {
      setStatusMessage("Authentication failed. Check your credentials and try again.");
    } finally {
      setAuthLoading(null);
    }
  };

  const addExpense = async () => {
    setExpenseSaving(true);
    setStatusMessage(editingExpenseId ? "Saving expense" : "Adding expense");

    try {
      const response = await fetch(
        editingExpenseId ? `${apiBaseUrl}/expenses/${editingExpenseId}` : `${apiBaseUrl}/expenses`,
        {
          method: editingExpenseId ? "PUT" : "POST",
          headers: authHeaders(token),
          body: JSON.stringify(expenseForm)
        }
      );
      const saved = await readJson<Expense>(response);

      setExpenses((current) =>
        editingExpenseId
          ? current.map((expense) => (expense.id === saved.id ? saved : expense))
          : [...current, saved]
      );
      setEditingExpenseId(null);
      setExpenseForm((current) => ({
        ...current,
        amount: "",
        description: ""
      }));
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to save expense.");
    } finally {
      setExpenseSaving(false);
    }
  };

  const startEditingExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      amount: normalizeCentsForInput(expense.amountCents),
      description: expense.description,
      categoryId: expense.categoryId,
      occurredOn: expense.occurredOn
    });
  };

  const cancelEditingExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm((current) => ({
      ...current,
      amount: "",
      description: ""
    }));
    setStatusMessage("");
  };

  const clearFilters = () => {
    setPeriodPreset("currentMonth");
    setFilterCategory("");
    setFromDate(defaultDateRange.from);
    setToDate(defaultDateRange.to);
  };

  const applyPeriodPreset = (preset: DateRangePreset | "custom") => {
    setPeriodPreset(preset);

    if (preset === "custom") {
      return;
    }

    const range = getDateRangeForPreset(preset, todayDate);
    setFromDate(range.from);
    setToDate(range.to);
    setStatusMessage("");
  };

  const updateCustomRange = (nextRange: { from: string; to: string }) => {
    setPeriodPreset("custom");
    setFromDate(nextRange.from);
    setToDate(nextRange.to);

    if (!nextRange.from || !nextRange.to) {
      return;
    }

    try {
      normalizeCustomDateRange(nextRange);
      setStatusMessage("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invalid date range.");
    }
  };

  const addCategory = async () => {
    setCategorySaving(true);
    setStatusMessage("Saving category");

    try {
      const response = await fetch(`${apiBaseUrl}/categories`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: newCategory })
      });
      const created = await readJson<Category>(response);

      setCategories((current) => [...current, created]);
      setExpenseForm((current) => ({
        ...current,
        categoryId: created.id
      }));
      setNewCategory("");
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to save category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const saveBudget = async () => {
    setBudgetSaving(true);
    setStatusMessage("Saving budget");

    try {
      const normalized = normalizeBudgetInput(budgetForm);
      const response = await fetch(`${apiBaseUrl}/budgets/${normalized.categoryId}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ amount: budgetForm.amount })
      });
      const saved = await readJson<Budget>(response);

      setBudgets((current) => {
        const withoutCurrent = current.filter((budget) => budget.categoryId !== saved.categoryId);

        return [...withoutCurrent, saved];
      });
      setBudgetForm((current) => ({
        ...current,
        amount: ""
      }));
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to save budget.");
    } finally {
      setBudgetSaving(false);
    }
  };

  const saveGoals = async () => {
    setGoalSaving(true);
    setStatusMessage("Saving goals");

    try {
      const normalized = normalizeFinancialGoalInput(goalForm);
      const response = await fetch(`${apiBaseUrl}/goals`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(goalForm)
      });
      const saved = await readJson<FinancialGoal>(response);

      setGoal(saved);
      setGoalForm({
        expenseLimit: normalizeCentsForInput(normalized.monthlyExpenseLimitCents),
        savingsTarget: normalizeCentsForInput(normalized.monthlySavingsTargetCents)
      });
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to save goals.");
    } finally {
      setGoalSaving(false);
    }
  };

  const addFixedExpense = async () => {
    setFixedExpenseSaving(true);
    setStatusMessage("Saving fixed expense");

    try {
      normalizeFixedExpenseInput(fixedExpenseForm);
      const response = await fetch(`${apiBaseUrl}/fixed-expenses`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(fixedExpenseForm)
      });
      const saved = await readJson<FixedExpense>(response);

      setFixedExpenses((current) => [...current, saved]);
      setFixedExpenseForm((current) => ({
        amount: "",
        description: "",
        categoryId: current.categoryId
      }));
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to save fixed expense.");
    } finally {
      setFixedExpenseSaving(false);
    }
  };

  const deleteFixedExpense = async (fixedExpense: FixedExpense) => {
    setDeletingFixedExpenseId(fixedExpense.id);
    setStatusMessage(`Deleting ${fixedExpense.description}`);

    try {
      await fetch(`${apiBaseUrl}/fixed-expenses/${fixedExpense.id}`, {
        method: "DELETE",
        headers: authHeaders(token)
      });
      setFixedExpenses((current) => current.filter((item) => item.id !== fixedExpense.id));
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to delete fixed expense.");
    } finally {
      setDeletingFixedExpenseId(null);
    }
  };

  const exportCsv = () => {
    const csv = buildExpenseCsv(visibleExpenses, categoryNameById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteExpense = async (expense: Expense) => {
    setDeletingExpenseId(expense.id);
    setStatusMessage(`Deleting ${expense.description}`);

    try {
      await fetch(`${apiBaseUrl}/expenses/${expense.id}`, {
        method: "DELETE",
        headers: authHeaders(token)
      });
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      setStatusMessage("");
    } catch {
      setStatusMessage("Unable to delete expense.");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-hero" aria-label="Product overview">
          <span className="eyebrow">Financial command center</span>
          <h1>Control your expenses in one place</h1>
          <p>
            Track spending, shape categories, and turn daily expenses into usable financial clarity.
          </p>
          <div className="hero-ledger" aria-hidden="true">
            <div>
              <span>Monthly visibility</span>
              <strong>$12.4k</strong>
            </div>
            <div>
              <span>Auto reports</span>
              <strong>6</strong>
            </div>
            <div>
              <span>Categories</span>
              <strong>Live</strong>
            </div>
          </div>
        </section>
        <section className="auth-panel" aria-labelledby="auth-title">
          <span className="panel-kicker">Secure workspace</span>
          <h1 id="auth-title">Expense Tracker</h1>
          <label>
            Email
            <input
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              type="email"
            />
          </label>
          <label>
            Password
            <input
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              type="password"
            />
          </label>
          <button
            type="button"
            aria-label="Create account"
            disabled={authLoading !== null}
            onClick={() => void authenticate("signup")}
          >
            {authLoading === "signup" ? <LoaderCircle aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {authLoading === "signup" ? "Creating" : "Create"}
          </button>
          <button
            type="button"
            aria-label="Log in"
            disabled={authLoading !== null}
            onClick={() => void authenticate("login")}
          >
            {authLoading === "login" ? <LoaderCircle aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            {authLoading === "login" ? "Signing in" : "Log in"}
          </button>
          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">Personal finance ledger</span>
          <p>{user.email}</p>
          <h1>Expenses</h1>
        </div>
        <div className="header-actions" aria-label="Dashboard summary">
          <span
            className="global-mood-chip"
            data-testid="global-mood-chip"
            data-status={financialMood?.status ?? "unset"}
          >
            <Gauge aria-hidden="true" />
            <small>Mood</small>
            <strong>{financialMood?.label ?? "Set goal"}</strong>
          </span>
          <span>{visibleExpenses.length} transactions</span>
          <span>{categories.length} categories</span>
        </div>
      </header>

      <nav className="view-switcher" aria-label="Expense views">
        <button
          type="button"
          aria-label="Open dashboard"
          className={activeView === "dashboard" ? "active" : "secondary-action"}
          onClick={() => setActiveView("dashboard")}
        >
          <BarChart3 aria-hidden="true" />
          Dashboard
        </button>
        <button
          type="button"
          aria-label="Open detailed report"
          className={activeView === "report" ? "active" : "secondary-action"}
          onClick={() => setActiveView("report")}
        >
          <BookOpen aria-hidden="true" />
          Report
        </button>
      </nav>

      <section className="hero-panel" aria-labelledby="dashboard-title">
        <div>
          <span className="panel-kicker">June cash pulse</span>
          <h2 id="dashboard-title">{report.monthlyTotal}</h2>
          <p>Live total for the selected filters, backed by your expense ledger.</p>
          {isLoadingDashboard ? <p className="status-message">Loading dashboard</p> : null}
          {!isLoadingDashboard && statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </div>
        <div className="metric-strip">
          <div>
            <span>Visible expenses</span>
            <strong>{visibleExpenses.length}</strong>
          </div>
          <div>
            <span>Top category</span>
            <strong>{topCategory}</strong>
          </div>
          <div>
            <span>Report rows</span>
            <strong>{report.rows.length}</strong>
          </div>
        </div>
        <strong className="sr-only" data-testid="monthly-total">
          {report.monthlyTotal}
        </strong>
      </section>

      {activeView === "dashboard" ? (
        <section className="dashboard-layout" data-testid="dashboard-layout">
          <div className="dashboard-actions" data-testid="dashboard-actions">
            <form className="panel" onSubmit={(event) => event.preventDefault()}>
              <div className="panel-heading">
                <span className="panel-kicker">Transaction intake</span>
                <h2>Add expense</h2>
                {editingExpenseId ? <p>Editing selected transaction</p> : null}
              </div>
              <label>
                Amount
                <input
                  value={formatMoneyInputValue(expenseForm.amount)}
                  disabled={expenseSaving || isLoadingDashboard}
                  onChange={(event) =>
                    setExpenseForm({
                      ...expenseForm,
                      amount: normalizeMoneyInputValue(event.target.value)
                    })
                  }
                  inputMode="decimal"
                />
              </label>
              <label>
                Description
                <input
                  value={expenseForm.description}
                  disabled={expenseSaving || isLoadingDashboard}
                  onChange={(event) =>
                    setExpenseForm({ ...expenseForm, description: event.target.value })
                  }
                />
              </label>
              <label>
                Category
                <select
                  data-testid="expense-category"
                  value={expenseForm.categoryId}
                  disabled={expenseSaving || isLoadingDashboard || categories.length === 0}
                  onChange={(event) =>
                    setExpenseForm({ ...expenseForm, categoryId: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  value={expenseForm.occurredOn}
                  disabled={expenseSaving || isLoadingDashboard}
                  onChange={(event) =>
                    setExpenseForm({ ...expenseForm, occurredOn: event.target.value })
                  }
                  type="date"
                />
              </label>
              <button
                type="button"
                aria-label={editingExpenseId ? "Save expense" : "Add expense"}
                disabled={!canSubmitExpense}
                onClick={() => void addExpense()}
              >
                {expenseSaving ? (
                  <LoaderCircle aria-hidden="true" />
                ) : editingExpenseId ? (
                  <Save aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {expenseSaving ? "Saving" : editingExpenseId ? "Save" : "Add"}
              </button>
              {editingExpenseId ? (
                <button
                  className="secondary-action"
                  type="button"
                  aria-label="Cancel edit"
                  disabled={expenseSaving}
                  onClick={cancelEditingExpense}
                >
                  <SearchX aria-hidden="true" />
                  Cancel
                </button>
              ) : null}
            </form>

            <section className="panel">
              <div className="panel-heading">
                <span className="panel-kicker">Ledger structure</span>
                <h2>Categories</h2>
              </div>
              <label>
                New category
                <input
                  value={newCategory}
                  disabled={categorySaving || isLoadingDashboard}
                  onChange={(event) => setNewCategory(event.target.value)}
                />
              </label>
              <button
                type="button"
                aria-label="Add category"
                disabled={!canAddCategory}
                onClick={() => void addCategory()}
              >
                {categorySaving ? <LoaderCircle aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                {categorySaving ? "Saving" : "Add"}
              </button>
            </section>
          </div>

          <div className="dashboard-content" data-testid="dashboard-content">
            <section className="panel ledger-panel">
              <div className="toolbar">
            <div className="panel-heading">
              <span className="panel-kicker">Filtered ledger</span>
              <h2>Expense list</h2>
            </div>
            <label>
              Filter category
              <select
                data-testid="filter-category"
                value={filterCategory}
                disabled={isLoadingDashboard}
                onChange={(event) => setFilterCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period
              <select
                aria-label="Period"
                value={periodPreset}
                disabled={isLoadingDashboard}
                onChange={(event) => applyPeriodPreset(event.target.value as DateRangePreset | "custom")}
              >
                <option value="currentMonth">Current month</option>
                <option value="last7">Last 7 days</option>
                <option value="last14">Last 14 days</option>
                <option value="last30">Last 30 days</option>
                <option value="lastMonth">Last month</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label>
              From date
              <input
                value={fromDate}
                disabled={isLoadingDashboard || periodPreset !== "custom"}
                onChange={(event) => updateCustomRange({ from: event.target.value, to: toDate })}
                type="date"
              />
            </label>
            <label>
              To date
              <input
                value={toDate}
                disabled={isLoadingDashboard || periodPreset !== "custom"}
                onChange={(event) => updateCustomRange({ from: fromDate, to: event.target.value })}
                type="date"
              />
            </label>
            {hasActiveFilters ? (
              <button
                className="secondary-action"
                type="button"
                aria-label="Clear filters"
                disabled={isLoadingDashboard}
                onClick={clearFilters}
              >
                <SearchX aria-hidden="true" />
                Clear
              </button>
            ) : null}
              </div>
              {isLoadingDashboard ? (
                <SkeletonRows count={4} />
              ) : visibleExpenses.length === 0 ? (
                <div className="empty-state">
                  <strong>{report.emptyMessage}</strong>
                  {hasActiveFilters ? (
                    <button
                      className="secondary-action"
                      type="button"
                      aria-label="Clear filters"
                      onClick={clearFilters}
                    >
                      <SearchX aria-hidden="true" />
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul className="expense-list">
                  {visibleExpenses.map((expense) => (
                    <li key={expense.id}>
                      <span>
                        <strong data-testid="expense-description">{expense.description}</strong>
                        <small>{categoryNameById[expense.categoryId] ?? expense.categoryId}</small>
                      </span>
                      <div className="expense-row-actions">
                        <span className="expense-amount">{formatCents(expense.amountCents)}</span>
                        <button
                          type="button"
                          aria-label={`Edit ${expense.description}`}
                          disabled={expenseSaving || deletingExpenseId !== null}
                          onClick={() => startEditingExpense(expense)}
                        >
                          <Edit3 aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${expense.description}`}
                          disabled={expenseSaving || deletingExpenseId !== null}
                          onClick={() => void deleteExpense(expense)}
                        >
                          {deletingExpenseId === expense.id ? (
                            <LoaderCircle aria-hidden="true" />
                          ) : (
                            <Trash2 aria-hidden="true" />
                          )}
                          {deletingExpenseId === expense.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel spend-preview-panel" data-testid="category-breakdown">
              <div className="panel-heading">
                <span className="panel-kicker">Spend intelligence</span>
                <h2>Reports</h2>
              </div>
              {isLoadingDashboard ? (
                <SkeletonRows count={3} />
              ) : report.rows.length === 0 ? (
                <p>No category spending yet.</p>
              ) : (
                <ul className="report-list compact-report-list">
                  {report.rows.map((row) => (
                    <li key={row.label}>
                      <div>
                        <strong>{row.label}</strong>
                        <span>{row.amount}</span>
                      </div>
                      <div className="report-track">
                        <span style={{ width: row.percentageLabel }} />
                      </div>
                      <small>{row.percentageLabel}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      ) : (
        <section className="report-grid">
          <section className="report-summary wide-report">
            <div className="panel report-toolbar">
              <div className="panel-heading">
                <span className="panel-kicker">Goal-based report</span>
                <h2>Detailed report</h2>
              </div>
              <button type="button" aria-label="Export CSV" onClick={exportCsv}>
                <Download aria-hidden="true" />
                CSV
              </button>
            </div>
            <div className="goal-report">
              <section
                className="mood-card"
                data-testid="financial-mood"
                data-status={financialMood?.status ?? "unset"}
                aria-labelledby="financial-mood-title"
              >
                <div className="mood-header">
                  <span className="mood-icon" aria-hidden="true">
                    <Gauge />
                  </span>
                  <div>
                    <span className="panel-kicker">Mood indicator</span>
                    <h2 id="financial-mood-title">Financial mood</h2>
                  </div>
                </div>
                {financialMood ? (
                  <>
                    <strong>{financialMood.label}</strong>
                    <p>{financialMood.message}</p>
                    <div className="mood-track">
                      <span style={{ width: `${Math.min(100, Math.max(4, financialMood.limitUsedPercentage))}%` }} />
                    </div>
                    <div className="mood-grid">
                      <span>
                        <small>Spent</small>
                        <strong>{formatCents(financialMood.monthlySpentCents)}</strong>
                      </span>
                      <span>
                        <small>Fixed monthly</small>
                        <strong>{formatCents(goalSpend.fixedExpenseCents)}</strong>
                      </span>
                      <span>
                        <small>Limit left</small>
                        <strong>{formatCents(financialMood.remainingLimitCents)}</strong>
                      </span>
                      <span>
                        <small>Savings buffer</small>
                        <strong>
                          {financialMood.savingsBufferCents >= 0
                            ? formatCents(financialMood.savingsBufferCents)
                            : `${formatCents(Math.abs(financialMood.savingsBufferCents))} short`}
                        </strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Set a goal</strong>
                    <p>Add a monthly expense limit and saving target to generate a mood indicator.</p>
                  </>
                )}
              </section>

              <section className="goal-form" aria-labelledby="goals-title">
                <div className="panel-heading">
                  <span className="panel-kicker">Monthly goals</span>
                  <h2 id="goals-title">Expense limit and savings</h2>
                </div>
                <label>
                  Monthly expense limit
                  <input
                    value={formatMoneyInputValue(goalForm.expenseLimit)}
                    disabled={goalSaving || isLoadingDashboard}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        expenseLimit: normalizeMoneyInputValue(event.target.value)
                      })
                    }
                    inputMode="decimal"
                  />
                </label>
                <label>
                  Saving target
                  <input
                    value={formatMoneyInputValue(goalForm.savingsTarget)}
                    disabled={goalSaving || isLoadingDashboard}
                    onChange={(event) =>
                      setGoalForm({
                        ...goalForm,
                        savingsTarget: normalizeMoneyInputValue(event.target.value)
                      })
                    }
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Save goals"
                  disabled={!canSaveGoals}
                  onClick={() => void saveGoals()}
                >
                  {goalSaving ? <LoaderCircle aria-hidden="true" /> : <Target aria-hidden="true" />}
                  {goalSaving ? "Saving" : "Save goals"}
                </button>
              </section>

              <section className="goal-insights" aria-label="Goal insights">
                <div>
                  <PiggyBank aria-hidden="true" />
                  <span>Saving target</span>
                  <strong>{goal ? formatCents(goal.monthlySavingsTargetCents) : "Not set"}</strong>
                </div>
                <div>
                  <Target aria-hidden="true" />
                  <span>Expense limit</span>
                  <strong>{goal ? formatCents(goal.monthlyExpenseLimitCents) : "Not set"}</strong>
                </div>
                <div>
                  <BarChart3 aria-hidden="true" />
                  <span>Budgeted categories</span>
                  <strong>{budgets.length}</strong>
                </div>
              </section>
            </div>
          </section>

          <section className="panel" data-testid="fixed-expense-list">
            <div className="panel-heading">
              <span className="panel-kicker">Monthly commitments</span>
              <h2>Fixed expenses</h2>
            </div>
            <label>
              Fixed amount
              <input
                value={formatMoneyInputValue(fixedExpenseForm.amount)}
                disabled={fixedExpenseSaving || isLoadingDashboard}
                onChange={(event) =>
                  setFixedExpenseForm({
                    ...fixedExpenseForm,
                    amount: normalizeMoneyInputValue(event.target.value)
                  })
                }
                inputMode="decimal"
              />
            </label>
            <label>
              Fixed description
              <input
                value={fixedExpenseForm.description}
                disabled={fixedExpenseSaving || isLoadingDashboard}
                onChange={(event) =>
                  setFixedExpenseForm({ ...fixedExpenseForm, description: event.target.value })
                }
              />
            </label>
            <label>
              Fixed category
              <select
                value={fixedExpenseForm.categoryId}
                disabled={fixedExpenseSaving || isLoadingDashboard || categories.length === 0}
                onChange={(event) =>
                  setFixedExpenseForm({ ...fixedExpenseForm, categoryId: event.target.value })
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="Add fixed expense"
              disabled={!canAddFixedExpense}
              onClick={() => void addFixedExpense()}
            >
              {fixedExpenseSaving ? <LoaderCircle aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {fixedExpenseSaving ? "Saving" : "Add fixed"}
            </button>
            {fixedExpenses.length === 0 ? (
              <p>No fixed monthly expenses configured.</p>
            ) : (
              <ul className="fixed-expense-list">
                {fixedExpenses.map((fixedExpense) => (
                  <li key={fixedExpense.id}>
                    <span>
                      <strong>{fixedExpense.description}</strong>
                      <small>{categoryNameById[fixedExpense.categoryId] ?? fixedExpense.categoryId}</small>
                    </span>
                    <span>{formatCents(fixedExpense.amountCents)}</span>
                    <button
                      type="button"
                      aria-label={`Delete fixed ${fixedExpense.description}`}
                      disabled={deletingFixedExpenseId !== null}
                      onClick={() => void deleteFixedExpense(fixedExpense)}
                    >
                      {deletingFixedExpenseId === fixedExpense.id ? (
                        <LoaderCircle aria-hidden="true" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      {deletingFixedExpenseId === fixedExpense.id ? "Deleting" : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" data-testid="spending-trends">
            <div className="panel-heading">
              <span className="panel-kicker">Spending trends visualization</span>
              <h2>Monthly trends</h2>
            </div>
            {trends.length === 0 ? (
              <p>No trend data yet.</p>
            ) : (
              <ul className="trend-list">
                {trends.map((trend) => (
                  <li key={trend.month}>
                    <div>
                      <strong>{trend.month}</strong>
                      <span>{formatCents(trend.totalCents)}</span>
                    </div>
                    <div className="report-track">
                      <span style={{ width: `${Math.max(6, (trend.totalCents / maxTrendCents) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <span className="panel-kicker">Budget setting per category</span>
              <h2>Budgets</h2>
            </div>
            <label>
              Budget category
              <select
                value={budgetForm.categoryId}
                onChange={(event) => setBudgetForm({ ...budgetForm, categoryId: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monthly budget
              <input
                value={formatMoneyInputValue(budgetForm.amount)}
                onChange={(event) =>
                  setBudgetForm({
                    ...budgetForm,
                    amount: normalizeMoneyInputValue(event.target.value)
                  })
                }
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              aria-label="Save budget"
              disabled={!canSaveBudget}
              onClick={() => void saveBudget()}
            >
              {budgetSaving ? <LoaderCircle aria-hidden="true" /> : <Save aria-hidden="true" />}
              {budgetSaving ? "Saving" : "Save"}
            </button>
          </section>

          <section className="panel wide-report" data-testid="budget-summary">
            <div className="panel-heading">
              <span className="panel-kicker">Budget progress</span>
              <h2>Budget summary</h2>
            </div>
            {budgetSummaries.length === 0 ? (
              <p>No budgets set yet.</p>
            ) : (
              <ul className="budget-list">
                {budgetSummaries.map((budget) => (
                  <li key={budget.categoryId} data-status={budget.status}>
                    <div>
                      <strong>{budget.categoryName}</strong>
                      <span>
                        {budget.remainingCents >= 0
                          ? `${formatCents(budget.remainingCents)} left`
                          : `${formatCents(Math.abs(budget.remainingCents))} over`}
                      </span>
                    </div>
                    <div className="report-track">
                      <span style={{ width: `${Math.min(100, Math.max(4, budget.percentageUsed))}%` }} />
                    </div>
                    <small>
                      {formatCents(budget.spentCents)} of {formatCents(budget.monthlyLimitCents)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </main>
  );
};
