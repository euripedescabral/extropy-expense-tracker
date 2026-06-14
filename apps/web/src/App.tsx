import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit3,
  LoaderCircle,
  LogIn,
  Plus,
  Save,
  SearchX,
  Trash2,
  UserPlus
} from "lucide-react";
import {
  filterExpenses,
  getCategoryBreakdown,
  getMonthlyTotal,
  type Expense
} from "@expense-tracker/core";
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

export const App = () => {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
  const [authLoading, setAuthLoading] = useState<"login" | "signup" | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const hasActiveFilters = Boolean(filterCategory || fromDate || toDate);
  const canSubmitExpense =
    Boolean(expenseForm.amount.trim()) &&
    Boolean(expenseForm.description.trim()) &&
    Boolean(expenseForm.categoryId) &&
    Boolean(expenseForm.occurredOn) &&
    !expenseSaving &&
    !isLoadingDashboard;
  const canAddCategory = Boolean(newCategory.trim()) && !categorySaving && !isLoadingDashboard;

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
      )
    ]).then(([nextCategories, nextExpenses]: [Category[], Expense[]]) => {
      setCategories(nextCategories);
      setExpenses(nextExpenses);
      setExpenseForm((current) => ({
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

  const monthlyTotalCents = getMonthlyTotal(visibleExpenses, "2026-06");
  const breakdown = getCategoryBreakdown(visibleExpenses).map((item) => ({
    ...item,
    categoryName: categoryNameById[item.categoryId] ?? item.categoryId
  }));
  const topCategory = breakdown[0]?.categoryName ?? "No spend yet";
  const report = buildReportViewModel({
    monthlyTotalCents,
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
      amount: String(expense.amountCents / 100),
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
    setFilterCategory("");
    setFromDate("");
    setToDate("");
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
          <span>{visibleExpenses.length} transactions</span>
          <span>{categories.length} categories</span>
        </div>
      </header>

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

      <section className="layout-grid">
        <form className="panel" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <span className="panel-kicker">Transaction intake</span>
            <h2>Add expense</h2>
            {editingExpenseId ? <p>Editing selected transaction</p> : null}
          </div>
          <label>
            Amount
            <input
              value={expenseForm.amount}
              disabled={expenseSaving || isLoadingDashboard}
              onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
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

        <section className="panel wide">
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
              From date
              <input
                value={fromDate}
                disabled={isLoadingDashboard}
                onChange={(event) => setFromDate(event.target.value)}
                type="date"
              />
            </label>
            <label>
              To date
              <input
                value={toDate}
                disabled={isLoadingDashboard}
                onChange={(event) => setToDate(event.target.value)}
                type="date"
              />
            </label>
            {hasActiveFilters ? (
              <button
                className="secondary-action"
                type="button"
                aria-hidden="true"
                tabIndex={-1}
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
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" data-testid="category-breakdown">
          <div className="panel-heading">
            <span className="panel-kicker">Spend intelligence</span>
            <h2>Reports</h2>
          </div>
          {isLoadingDashboard ? (
            <SkeletonRows count={3} />
          ) : report.rows.length === 0 ? (
            <p>No category spending yet.</p>
          ) : (
            <ul className="report-list">
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
      </section>
    </main>
  );
};
