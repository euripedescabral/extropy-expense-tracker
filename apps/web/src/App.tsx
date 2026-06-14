import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!token) {
      return;
    }

    void Promise.all([
      fetch(`${apiBaseUrl}/categories`, { headers: authHeaders(token) }).then((response) =>
        response.json()
      ),
      fetch(`${apiBaseUrl}/expenses`, { headers: authHeaders(token) }).then((response) =>
        response.json()
      )
    ]).then(([nextCategories, nextExpenses]: [Category[], Expense[]]) => {
      setCategories(nextCategories);
      setExpenses(nextExpenses);
      setExpenseForm((current) => ({
        ...current,
        categoryId: nextCategories[0]?.id ?? ""
      }));
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
    const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(authForm)
    });
    const body = (await response.json()) as { token: string; user: User };

    setToken(body.token);
    setUser(body.user);
  };

  const addExpense = async () => {
    const response = await fetch(
      editingExpenseId ? `${apiBaseUrl}/expenses/${editingExpenseId}` : `${apiBaseUrl}/expenses`,
      {
        method: editingExpenseId ? "PUT" : "POST",
        headers: authHeaders(token),
        body: JSON.stringify(expenseForm)
      }
    );
    const saved = (await response.json()) as Expense;

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

  const addCategory = async () => {
    const response = await fetch(`${apiBaseUrl}/categories`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: newCategory })
    });
    const created = (await response.json()) as Category;

    setCategories((current) => [...current, created]);
    setExpenseForm((current) => ({
      ...current,
      categoryId: created.id
    }));
    setNewCategory("");
  };

  const deleteExpense = async (expense: Expense) => {
    await fetch(`${apiBaseUrl}/expenses/${expense.id}`, {
      method: "DELETE",
      headers: authHeaders(token)
    });
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
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
          <button type="button" onClick={() => void authenticate("signup")}>
            Create account
          </button>
          <button type="button" onClick={() => void authenticate("login")}>
            Log in
          </button>
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
          </div>
          <label>
            Amount
            <input
              value={expenseForm.amount}
              onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
              inputMode="decimal"
            />
          </label>
          <label>
            Description
            <input
              value={expenseForm.description}
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
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, occurredOn: event.target.value })
              }
              type="date"
            />
          </label>
          <button type="button" onClick={() => void addExpense()}>
            {editingExpenseId ? "Save expense" : "Add expense"}
          </button>
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
              onChange={(event) => setNewCategory(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => void addCategory()}>
            Add category
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
                onChange={(event) => setFromDate(event.target.value)}
                type="date"
              />
            </label>
            <label>
              To date
              <input
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                type="date"
              />
            </label>
          </div>
          {visibleExpenses.length === 0 ? (
            <p>{report.emptyMessage}</p>
          ) : (
            <ul className="expense-list">
              {visibleExpenses.map((expense) => (
                <li key={expense.id}>
                  <span>
                    <strong data-testid="expense-description">{expense.description}</strong>
                    <small>{categoryNameById[expense.categoryId] ?? expense.categoryId}</small>
                  </span>
                  <span className="expense-amount">{formatCents(expense.amountCents)}</span>
                  <button type="button" onClick={() => startEditingExpense(expense)}>
                    Edit {expense.description}
                  </button>
                  <button type="button" onClick={() => void deleteExpense(expense)}>
                    Delete {expense.description}
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
          {report.rows.length === 0 ? (
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
