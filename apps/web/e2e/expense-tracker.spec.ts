import { expect, test } from "@playwright/test";

type Expense = {
  id: string;
  amountCents: number;
  description: string;
  categoryId: string;
  occurredOn: string;
};

type Category = {
  id: string;
  name: string;
  kind: "system" | "custom";
};

test.describe("expense tracker critical flows", () => {
  test.beforeEach(async ({ page }) => {
    const expenses: Expense[] = [];
    const categories: Category[] = [
      { id: "food", name: "Food", kind: "system" },
      { id: "transport", name: "Transport", kind: "system" },
      { id: "entertainment", name: "Entertainment", kind: "system" }
    ];

    await page.route("**/api/auth/*", async (route) => {
      await route.fulfill({
        status: route.request().url().endsWith("/signup") ? 201 : 200,
        json: {
          token: "test-token",
          user: { id: "user_1", email: "ada@example.com" }
        }
      });
    });

    await page.route("**/api/categories", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name: string };
        const category = {
          id: body.name.toLowerCase().replaceAll(" ", "-"),
          name: body.name.trim(),
          kind: "custom" as const
        };
        categories.push(category);
        await route.fulfill({ status: 201, json: category });
        return;
      }

      await route.fulfill({ status: 200, json: categories });
    });

    await page.route("**/api/expenses**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "POST") {
        const body = request.postDataJSON() as {
          amount: string;
          description: string;
          categoryId: string;
          occurredOn: string;
        };
        const expense = {
          id: `exp_${expenses.length + 1}`,
          amountCents: Math.round(Number(body.amount) * 100),
          description: body.description,
          categoryId: body.categoryId,
          occurredOn: body.occurredOn
        };
        expenses.push(expense);
        await route.fulfill({ status: 201, json: expense });
        return;
      }

      if (request.method() === "PUT") {
        const id = url.pathname.split("/").at(-1);
        const body = request.postDataJSON() as {
          amount: string;
          description: string;
          categoryId: string;
          occurredOn: string;
        };
        const updated = {
          id: id ?? "exp_unknown",
          amountCents: Math.round(Number(body.amount) * 100),
          description: body.description,
          categoryId: body.categoryId,
          occurredOn: body.occurredOn
        };
        const index = expenses.findIndex((expense) => expense.id === id);
        if (index >= 0) {
          expenses[index] = updated;
        }
        await route.fulfill({ status: 200, json: updated });
        return;
      }

      if (request.method() === "DELETE") {
        const id = url.pathname.split("/").at(-1);
        const index = expenses.findIndex((expense) => expense.id === id);
        if (index >= 0) {
          expenses.splice(index, 1);
        }
        await route.fulfill({ status: 204, body: "" });
        return;
      }

      await route.fulfill({ status: 200, json: expenses });
    });
  });

  test("signs up, adds an expense, filters it, and sees reports update", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Financial command center")).toBeVisible();
    await expect(page.getByText("Track spending, shape categories, and turn daily expenses into usable financial clarity.")).toBeVisible();

    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
    await expect(page.getByText("Personal finance ledger")).toBeVisible();
    await expect(page.getByText("June cash pulse")).toBeVisible();
    await expect(page.getByTestId("expense-category")).toContainText("Food");

    await page.getByLabel("Amount").fill("12.30");
    await page.getByLabel("Description").fill("Coffee");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(page.getByTestId("expense-description").filter({ hasText: "Coffee" })).toBeVisible();
    await expect(page.getByTestId("monthly-total")).toHaveText("$12.30");
    await expect(page.getByTestId("category-breakdown")).toContainText("Food");

    await page.getByTestId("filter-category").selectOption("transport");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Coffee" })).toBeHidden();

    await page.getByTestId("filter-category").selectOption("food");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Coffee" })).toBeVisible();
  });

  test("creates a custom category and deletes an expense with totals recalculated", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.getByLabel("New category").fill("Books");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("expense-category")).toContainText("Books");

    await page.getByLabel("Amount").fill("25.00");
    await page.getByLabel("Description").fill("Architecture book");
    await page.getByTestId("expense-category").selectOption("books");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Architecture book" })
    ).toBeVisible();
    await expect(page.getByTestId("monthly-total")).toHaveText("$25.00");

    await page.getByRole("button", { name: "Delete Architecture book" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Architecture book" })
    ).toBeHidden();
    await expect(page.getByTestId("monthly-total")).toHaveText("$0.00");
    await expect(page.getByText("No expenses found for this period.")).toBeVisible();
  });

  test("logs in, edits an expense, and filters by date range", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("9.50");
    await page.getByLabel("Description").fill("Breakfast");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-01");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Breakfast" })
    ).toBeVisible();
    await expect(page.getByLabel("Amount")).toHaveValue("");

    await page.getByLabel("Amount").fill("30.00");
    await page.getByLabel("Description").fill("Concert");
    await page.getByTestId("expense-category").selectOption("entertainment");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-20");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Concert" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit Breakfast" }).click();
    await page.getByLabel("Amount").fill("10.25");
    await page.getByLabel("Description").fill("Breakfast sandwich");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-02");
    await page.getByRole("button", { name: "Save expense" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Breakfast sandwich" })
    ).toBeVisible();
    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Concert" })
    ).toBeVisible();
    await expect(page.getByTestId("filter-category")).toHaveValue("");

    await page.getByLabel("From date").fill("2026-06-10");
    await page.getByLabel("To date").fill("2026-06-30");

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Breakfast sandwich" })
    ).toBeHidden();
    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Concert" })
    ).toBeVisible();
    await expect(page.getByTestId("monthly-total")).toHaveText("$30.00");
  });
});
