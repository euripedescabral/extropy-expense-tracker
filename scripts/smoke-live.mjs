const apiUrl = process.env.API_URL ?? "https://vr8i94iayl.execute-api.us-east-2.amazonaws.com";
const email = `live-smoke+${Date.now()}@example.com`;
const password = "CorrectHorse123!";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return { status: response.status, body };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const hasStorageKeys = (value) => JSON.stringify(value).includes('"pk"') || JSON.stringify(value).includes('"sk"');

const signup = await requestJson("/auth/signup", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
assert(signup.status === 201, "signup should return 201");
assert(signup.body.token, "signup should return token");

const login = await requestJson("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
assert(login.status === 200, "login should return 200");

const authHeaders = { authorization: `Bearer ${login.body.token}` };

const categories = await requestJson("/categories", { headers: authHeaders });
assert(Array.isArray(categories.body), "categories should return an array");
assert(categories.body.length > 0, "categories should include defaults");

const categoryId = categories.body[0].id;

const budget = await requestJson(`/budgets/${categoryId}`, {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({ amount: "500.00" })
});
assert(budget.status === 200, "budget upsert should return 200");
assert(budget.body.categoryId === categoryId, "budget should be saved for selected category");

const budgets = await requestJson("/budgets", { headers: authHeaders });
assert(Array.isArray(budgets.body), "budget list should return an array");
assert(budgets.body.some((item) => item.categoryId === categoryId), "budget list should include saved budget");

const goal = await requestJson("/goals", {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({ expenseLimit: "2000.00", savingsTarget: "500.00" })
});
assert(goal.status === 200, "goal upsert should return 200");
assert(goal.body.monthlyExpenseLimitCents === 200000, "goal should save expense limit");
assert(goal.body.monthlySavingsTargetCents === 50000, "goal should save savings target");

const loadedGoal = await requestJson("/goals", { headers: authHeaders });
assert(loadedGoal.status === 200, "goal get should return 200");
assert(loadedGoal.body.monthlySavingsTargetCents === 50000, "goal get should return saved target");

const fixedExpense = await requestJson("/fixed-expenses", {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    amount: "1200.00",
    description: "Live smoke rent",
    categoryId
  })
});
assert(fixedExpense.status === 201, "fixed expense create should return 201");
assert(fixedExpense.body.amountCents === 120000, "fixed expense should save amount");

const fixedExpenses = await requestJson("/fixed-expenses", { headers: authHeaders });
assert(Array.isArray(fixedExpenses.body), "fixed expense list should return an array");
assert(
  fixedExpenses.body.some((item) => item.id === fixedExpense.body.id),
  "fixed expense list should include created item"
);

const created = await requestJson("/expenses", {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    amount: "24.50",
    description: "Live smoke lunch",
    categoryId,
    occurredOn: "2026-06-14"
  })
});
assert(created.status === 201, "expense create should return 201");
assert(!hasStorageKeys(created.body), "expense create should not expose storage keys");

const updated = await requestJson(`/expenses/${created.body.id}`, {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({
    amount: "31.75",
    description: "Live smoke lunch updated",
    categoryId,
    occurredOn: "2026-06-14"
  })
});
assert(updated.status === 200, "expense update should return 200");
assert(!hasStorageKeys(updated.body), "expense update should not expose storage keys");

const listed = await requestJson("/expenses", { headers: authHeaders });
assert(listed.status === 200, "expense list should return 200");
assert(Array.isArray(listed.body), "expense list should return an array");
assert(listed.body.some((expense) => expense.id === created.body.id), "expense list should include created expense");
assert(!hasStorageKeys(listed.body), "expense list should not expose storage keys");

const deleted = await fetch(`${apiUrl}/expenses/${created.body.id}`, {
  method: "DELETE",
  headers: authHeaders
});
assert(deleted.status === 204, "expense delete should return 204");

const deletedFixedExpense = await fetch(`${apiUrl}/fixed-expenses/${fixedExpense.body.id}`, {
  method: "DELETE",
  headers: authHeaders
});
assert(deletedFixedExpense.status === 204, "fixed expense delete should return 204");

console.log("LIVE_SMOKE_PASSED", {
  apiUrl,
  email,
  routes: [
    "signup",
    "login",
    "categories",
    "upsert budget",
    "list budgets",
    "upsert goals",
    "get goals",
    "create fixed expense",
    "list fixed expenses",
    "create expense",
    "update expense",
    "list expenses",
    "delete expense",
    "delete fixed expense"
  ]
});
