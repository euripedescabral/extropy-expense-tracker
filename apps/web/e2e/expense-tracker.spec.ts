import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

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

type Budget = {
  userId: string;
  categoryId: string;
  monthlyLimitCents: number;
};

type FinancialGoal = {
  userId: string;
  monthlyExpenseLimitCents: number;
  monthlySavingsTargetCents: number;
};

type FixedExpense = {
  id: string;
  userId: string;
  amountCents: number;
  description: string;
  categoryId: string;
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fixedToday = "2026-06-15";

const expectNoDirectChildOverlap = async (page: Page, selectors: string[]) => {
  const overlapReport = await page.evaluate((targetSelectors) => {
    const overlaps = (first: DOMRect, second: DOMRect) =>
      !(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top);

    return targetSelectors.flatMap((selector) => {
      const root = document.querySelector(selector);

      if (!root) {
        return [{ selector, missing: true }];
      }

      const children = Array.from(root.children).map((child, index) => {
        const box = child.getBoundingClientRect();

        return {
          index,
          text: (child.textContent ?? child.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " "),
          box
        };
      });

      const collisions: Array<{ selector: string; first: string; second: string }> = [];

      for (let firstIndex = 0; firstIndex < children.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < children.length; secondIndex += 1) {
          if (overlaps(children[firstIndex].box, children[secondIndex].box)) {
            collisions.push({
              selector,
              first: children[firstIndex].text,
              second: children[secondIndex].text
            });
          }
        }
      }

      return collisions;
    });
  }, selectors);

  expect(overlapReport).toEqual([]);
};

test.describe("expense tracker critical flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${fixedToday}T12:00:00.000Z`));

    const expenses: Expense[] = [];
    const categories: Category[] = [
      { id: "food", name: "Food", kind: "system" },
      { id: "transport", name: "Transport", kind: "system" },
      { id: "entertainment", name: "Entertainment", kind: "system" }
    ];
    const budgets: Budget[] = [];
    const fixedExpenses: FixedExpense[] = [];
    let goal: FinancialGoal | null = null;

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
      const shouldDelay = route.request().headers().referer?.includes("delayDashboard=1");

      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name: string };
        const category = {
          id: body.name.toLowerCase().replaceAll(" ", "-"),
          name: body.name.trim(),
          kind: "custom" as const
        };
        if (route.request().headers().referer?.includes("delayMutations=1")) {
          await wait(250);
        }
        categories.push(category);
        await route.fulfill({ status: 201, json: category });
        return;
      }

      if (shouldDelay) {
        await wait(350);
      }
      await route.fulfill({ status: 200, json: categories });
    });

    await page.route("**/api/expenses**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const shouldDelayMutations = request.headers().referer?.includes("delayMutations=1");
      const shouldDelayDashboard = request.headers().referer?.includes("delayDashboard=1");

      if (request.method() === "POST") {
        const body = request.postDataJSON() as {
          amount: string;
          description: string;
          categoryId: string;
          occurredOn: string;
        };
        if (shouldDelayMutations) {
          await wait(250);
        }
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
        if (shouldDelayMutations) {
          await wait(250);
        }
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
        if (shouldDelayMutations) {
          await wait(250);
        }
        const index = expenses.findIndex((expense) => expense.id === id);
        if (index >= 0) {
          expenses.splice(index, 1);
        }
        await route.fulfill({ status: 204, body: "" });
        return;
      }

      if (shouldDelayDashboard) {
        await wait(350);
      }
      await route.fulfill({ status: 200, json: expenses });
    });

    await page.route("**/api/budgets**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "PUT") {
        const categoryId = url.pathname.split("/").at(-1) ?? "unknown";
        const body = request.postDataJSON() as { amount: string };
        const budget = {
          userId: "user_1",
          categoryId,
          monthlyLimitCents: Math.round(Number(body.amount) * 100)
        };
        const index = budgets.findIndex((item) => item.categoryId === categoryId);
        if (index >= 0) {
          budgets[index] = budget;
        } else {
          budgets.push(budget);
        }
        await route.fulfill({ status: 200, json: budget });
        return;
      }

      await route.fulfill({ status: 200, json: budgets });
    });

    await page.route("**/api/goals", async (route) => {
      const request = route.request();

      if (request.method() === "PUT") {
        const body = request.postDataJSON() as { expenseLimit: string; savingsTarget: string };
        goal = {
          userId: "user_1",
          monthlyExpenseLimitCents: Math.round(Number(body.expenseLimit) * 100),
          monthlySavingsTargetCents: Math.round(Number(body.savingsTarget) * 100)
        };
        await route.fulfill({ status: 200, json: goal });
        return;
      }

      await route.fulfill({ status: 200, json: goal });
    });

    await page.route("**/api/fixed-expenses**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "POST") {
        const body = request.postDataJSON() as {
          amount: string;
          description: string;
          categoryId: string;
        };
        const fixedExpense = {
          id: `fixed_${fixedExpenses.length + 1}`,
          userId: "user_1",
          amountCents: Math.round(Number(body.amount) * 100),
          description: body.description,
          categoryId: body.categoryId
        };
        fixedExpenses.push(fixedExpense);
        await route.fulfill({ status: 201, json: fixedExpense });
        return;
      }

      if (request.method() === "DELETE") {
        const id = url.pathname.split("/").at(-1);
        const index = fixedExpenses.findIndex((fixedExpense) => fixedExpense.id === id);
        if (index >= 0) {
          fixedExpenses.splice(index, 1);
        }
        await route.fulfill({ status: 204, body: "" });
        return;
      }

      await route.fulfill({ status: 200, json: fixedExpenses });
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
    await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(1);

    await page.getByTestId("filter-category").selectOption("food");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Coffee" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("filter-category")).toHaveValue("");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Coffee" })).toBeVisible();

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
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Concert" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit Breakfast" }).click();
    await expect(page.getByRole("button", { name: "Cancel edit" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel edit" }).click();
    await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();

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

    await page.getByLabel("Period").selectOption("custom");
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

  test("filters by useful period presets and caps custom ranges at 90 days", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("18.00");
    await page.getByLabel("Description").fill("Recent lunch");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill(fixedToday);
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByLabel("Amount").fill("45.00");
    await page.getByLabel("Description").fill("Older subscription");
    await page.getByTestId("expense-category").selectOption("entertainment");
    await page.getByLabel("Date", { exact: true }).fill("2026-03-01");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByLabel("Amount").fill("45.00");
    await page.getByLabel("Description").fill("Previous month transit");
    await page.getByTestId("expense-category").selectOption("transport");
    await page.getByLabel("Date", { exact: true }).fill("2026-05-20");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByLabel("Period").selectOption("last7");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Recent lunch" })).toBeVisible();
    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Older subscription" })
    ).toBeHidden();
    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Previous month transit" })
    ).toBeHidden();

    await page.getByLabel("Period").selectOption("lastMonth");
    await expect(
      page.getByTestId("expense-description").filter({ hasText: "Previous month transit" })
    ).toBeVisible();
    await expect(page.getByTestId("expense-description").filter({ hasText: "Recent lunch" })).toBeHidden();
    await expect(page.getByTestId("monthly-total")).toHaveText("$45.00");

    await page.getByLabel("Period").selectOption("custom");
    await page.getByLabel("From date").fill("2026-01-01");
    await page.getByLabel("To date").fill("2026-06-30");
    await expect(page.getByText("custom date range cannot exceed 90 days")).toBeVisible();
  });

  test("shows skeletons and pending states while async work is in flight", async ({ page }) => {
    await page.goto("/?delayDashboard=1&delayMutations=1");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Loading dashboard")).toBeVisible();
    await expect(page.getByTestId("dashboard-skeleton").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add expense" })).toBeVisible();

    await page.getByLabel("Amount").fill("14.00");
    await page.getByLabel("Description").fill("Slow coffee");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await expect(page.getByRole("button", { name: "Add expense" })).toContainText("Saving");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Slow coffee" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Slow coffee" })).toContainText("Edit");
    await expect(page.getByRole("button", { name: "Delete Slow coffee" })).toContainText("Delete");

    await page.getByLabel("New category").fill("Books");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByRole("button", { name: "Add category" })).toContainText("Saving");
    await expect(page.getByTestId("expense-category")).toContainText("Books");

    await page.getByRole("button", { name: "Delete Slow coffee" }).click();
    await expect(page.getByRole("button", { name: "Delete Slow coffee" })).toContainText("Deleting");
    await expect(page.getByTestId("expense-description").filter({ hasText: "Slow coffee" })).toBeHidden();
  });

  test("keeps dashboard controls and ledger in predictable responsive regions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("12.00");
    await page.getByLabel("Description").fill("Layout row");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.getByTestId("expense-description").filter({ hasText: "Layout row" })).toBeVisible();

    await expect(page.getByTestId("dashboard-layout")).toBeVisible();
    await expect(page.getByTestId("dashboard-actions")).toBeVisible();
    await expect(page.getByTestId("dashboard-content")).toBeVisible();

    const desktopRegions = await page.evaluate(() => {
      const actions = document.querySelector("[data-testid='dashboard-actions']")?.getBoundingClientRect();
      const content = document.querySelector("[data-testid='dashboard-content']")?.getBoundingClientRect();

      return {
        actions,
        content,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });

    expect(desktopRegions.actions).toBeTruthy();
    expect(desktopRegions.content).toBeTruthy();
    expect(desktopRegions.actions!.right).toBeLessThan(desktopRegions.content!.left);
    expect(desktopRegions.documentWidth).toBeLessThanOrEqual(desktopRegions.viewportWidth);
    await expect(page.locator(".toolbar")).toBeInViewport();
    await expect(page.locator(".expense-list")).toBeInViewport();
    const desktopContainedChildren = await page.evaluate(() => {
      const selectors = [".toolbar", ".expense-list", ".spend-preview-panel"];

      return selectors.map((selector) => {
        const child = document.querySelector(selector)?.getBoundingClientRect();
        const parent = document.querySelector(selector)?.parentElement?.getBoundingClientRect();

        return {
          selector,
          overflowRight: child && parent ? Math.ceil(child.right - parent.right) : 0
        };
      });
    });

    expect(desktopContainedChildren).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ selector: ".toolbar", overflowRight: expect.any(Number) }),
        expect.objectContaining({ selector: ".expense-list", overflowRight: expect.any(Number) })
      ])
    );
    for (const child of desktopContainedChildren) {
      expect(child.overflowRight).toBeLessThanOrEqual(0);
    }

    await page.setViewportSize({ width: 390, height: 844 });

    const mobileRegions = await page.evaluate(() => {
      const actions = document.querySelector("[data-testid='dashboard-actions']")?.getBoundingClientRect();
      const content = document.querySelector("[data-testid='dashboard-content']")?.getBoundingClientRect();

      return {
        actions,
        content,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });

    expect(mobileRegions.actions).toBeTruthy();
    expect(mobileRegions.content).toBeTruthy();
    expect(mobileRegions.content!.top).toBeGreaterThan(mobileRegions.actions!.bottom);
    expect(mobileRegions.documentWidth).toBeLessThanOrEqual(mobileRegions.viewportWidth);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1280, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      await expectNoDirectChildOverlap(page, [".toolbar", ".expense-list li", ".expense-row-actions"]);
      const region = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      }));
      expect(region.documentWidth).toBeLessThanOrEqual(region.viewportWidth);
    }
  });

  test("masks money fields while submitting normalized decimal payloads", async ({ page }) => {
    const submittedPayloads: Array<Record<string, string>> = [];

    page.on("request", (request) => {
      if (request.method() !== "POST" && request.method() !== "PUT") {
        return;
      }

      const url = request.url();
      if (
        url.includes("/api/expenses") ||
        url.includes("/api/budgets") ||
        url.includes("/api/goals") ||
        url.includes("/api/fixed-expenses")
      ) {
        submittedPayloads.push(request.postDataJSON() as Record<string, string>);
      }
    });

    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("1200.5");
    await expect(page.getByLabel("Amount")).toHaveValue("$1,200.50");
    await page.getByLabel("Description").fill("Masked expense");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByRole("button", { name: "Open detailed report" }).click();
    await page.getByLabel("Monthly expense limit").fill("2500");
    await page.getByLabel("Saving target").fill("500");
    await expect(page.getByLabel("Monthly expense limit")).toHaveValue("$2,500.00");
    await expect(page.getByLabel("Saving target")).toHaveValue("$500.00");
    await page.getByRole("button", { name: "Save goals" }).click();

    await page.getByLabel("Fixed amount").fill("1200");
    await expect(page.getByLabel("Fixed amount")).toHaveValue("$1,200.00");
    await page.getByLabel("Fixed description").fill("Rent");
    await page.getByLabel("Fixed category").selectOption("food");
    await page.getByRole("button", { name: "Add fixed expense" }).click();

    await page.getByLabel("Monthly budget").fill("250.5");
    await expect(page.getByLabel("Monthly budget")).toHaveValue("$250.50");
    await page.getByRole("button", { name: "Save budget" }).click();

    expect(submittedPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: "1200.50" }),
        expect.objectContaining({ expenseLimit: "2500.00", savingsTarget: "500.00" }),
        expect.objectContaining({ amount: "1200.00", description: "Rent" }),
        expect.objectContaining({ amount: "250.50" })
      ])
    );
  });

  test("keeps the financial mood visible in the top navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByTestId("global-mood-chip")).toBeVisible();
    await expect(page.getByTestId("global-mood-chip")).toContainText("Set goal");

    await page.getByLabel("Amount").fill("80.00");
    await page.getByLabel("Description").fill("June groceries");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByRole("button", { name: "Open detailed report" }).click();
    await page.getByLabel("Monthly expense limit").fill("100.00");
    await page.getByLabel("Saving target").fill("30.00");
    await page.getByRole("button", { name: "Save goals" }).click();

    await expect(page.getByTestId("global-mood-chip")).toContainText("Watchful");
    await page.getByRole("button", { name: "Open dashboard" }).click();
    await expect(page.getByTestId("global-mood-chip")).toContainText("Watchful");
  });

  test("sets category budgets, shows trend charts, and exports csv from the report view", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("80.00");
    await page.getByLabel("Description").fill("June groceries");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByLabel("Amount").fill("20.00");
    await page.getByLabel("Description").fill("May bus pass");
    await page.getByTestId("expense-category").selectOption("transport");
    await page.getByLabel("Date", { exact: true }).fill("2026-05-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByRole("button", { name: "Open detailed report" }).click();
    await expect(page.getByRole("heading", { name: "Detailed report" })).toBeVisible();
    await expect(page.getByTestId("spending-trends")).toContainText("2026-06");
    await expect(page.getByTestId("spending-trends")).not.toContainText("2026-05");

    await page.getByRole("button", { name: "Open dashboard" }).click();
    await page.getByLabel("Period").selectOption("custom");
    await page.getByLabel("From date").fill("2026-05-01");
    await page.getByLabel("To date").fill("2026-06-30");
    await page.getByRole("button", { name: "Open detailed report" }).click();
    await expect(page.getByTestId("spending-trends")).toContainText("2026-05");
    await expect(page.getByTestId("spending-trends")).toContainText("2026-06");
    const customRangeDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const customRangeDownload = await customRangeDownloadPromise;
    expect(customRangeDownload.suggestedFilename()).toBe("expenses.csv");
    const customRangeCsvPath = await customRangeDownload.path();
    expect(customRangeCsvPath).not.toBeNull();
    const customRangeCsv = await readFile(customRangeCsvPath as string, "utf8");
    expect(customRangeCsv).toContain("Date,Description,Category,Amount");
    expect(customRangeCsv).toContain("2026-06-14,June groceries,Food,80.00");
    expect(customRangeCsv).toContain("2026-05-14,May bus pass,Transport,20.00");

    await page.getByRole("button", { name: "Open dashboard" }).click();
    await page.getByTestId("filter-category").selectOption("entertainment");
    await expect(page.getByText("No expenses found for this period.")).toBeVisible();
    await page.getByRole("button", { name: "Open detailed report" }).click();
    await expect(page.getByTestId("spending-trends")).toContainText("No trend data yet.");
    await expect(page.getByTestId("spending-trends")).not.toContainText("2026-06");

    await page.getByRole("button", { name: "Open dashboard" }).click();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("button", { name: "Open detailed report" }).click();

    await page.getByLabel("Budget category").selectOption("food");
    await page.getByLabel("Monthly budget").fill("100.00");
    await page.getByRole("button", { name: "Save budget" }).click();

    await expect(page.getByTestId("budget-summary")).toContainText("Food");
    await expect(page.getByTestId("budget-summary")).toContainText("$20.00 left");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("expenses.csv");
    const csvPath = await download.path();
    expect(csvPath).not.toBeNull();
    const csv = await readFile(csvPath as string, "utf8");
    expect(csv).toContain("Date,Description,Category,Amount");
    expect(csv).toContain("2026-06-14,June groceries,Food,80.00");
    expect(csv).not.toContain("2026-05-14,May bus pass,Transport,20.00");
  });

  test("sets monthly goals and shows a mood indicator instead of repetitive totals", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByLabel("Amount").fill("80.00");
    await page.getByLabel("Description").fill("June groceries");
    await page.getByTestId("expense-category").selectOption("food");
    await page.getByLabel("Date", { exact: true }).fill("2026-06-14");
    await page.getByRole("button", { name: "Add expense" }).click();

    await page.getByRole("button", { name: "Open detailed report" }).click();
    await expect(page.getByRole("heading", { name: "Financial mood" })).toBeVisible();
    await expect(page.getByTestId("financial-mood")).toContainText("Set a goal");

    await page.getByLabel("Monthly expense limit").fill("100.00");
    await page.getByLabel("Saving target").fill("30.00");
    await page.getByRole("button", { name: "Save goals" }).click();

    await expect(page.getByTestId("financial-mood")).toContainText("Watchful");
    await expect(page.getByTestId("financial-mood")).toContainText("$10.00 short");
    await expect(page.getByText("Visible spend")).toHaveCount(0);
    await expect(page.getByText("All-time spend")).toHaveCount(0);
  });

  test("configures fixed monthly expenses and includes them in the mood indicator", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("CorrectHorse123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.getByRole("button", { name: "Open detailed report" }).click();
    await page.getByLabel("Monthly expense limit").fill("2000.00");
    await page.getByLabel("Saving target").fill("500.00");
    await page.getByRole("button", { name: "Save goals" }).click();

    await page.getByLabel("Fixed amount").fill("1200.00");
    await page.getByLabel("Fixed description").fill("Rent");
    await page.getByLabel("Fixed category").selectOption("food");
    await page.getByRole("button", { name: "Add fixed expense" }).click();

    await expect(page.getByTestId("fixed-expense-list")).toContainText("Rent");
    await expect(page.getByTestId("financial-mood")).toContainText("Confident");
    await expect(page.getByTestId("financial-mood")).toContainText("$1,200.00");

    await page.getByRole("button", { name: "Delete fixed Rent" }).click();
    await expect(page.getByTestId("fixed-expense-list")).not.toContainText("Rent");
  });
});
