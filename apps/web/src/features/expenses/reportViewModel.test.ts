import { describe, expect, it } from "vitest";
import { buildReportViewModel } from "./reportViewModel";

describe("report view model", () => {
  it("formats totals and category shares for display without changing cents in the domain layer", () => {
    expect(
      buildReportViewModel({
        monthlyTotalCents: 5799,
        breakdown: [
          { categoryId: "transport", categoryName: "Transport", totalCents: 4500, percentage: 77.6 },
          { categoryId: "food", categoryName: "Food", totalCents: 1299, percentage: 22.4 }
        ],
        locale: "en-US",
        currency: "USD"
      })
    ).toEqual({
      monthlyTotal: "$57.99",
      rows: [
        { label: "Transport", amount: "$45.00", percentageLabel: "77.6%" },
        { label: "Food", amount: "$12.99", percentageLabel: "22.4%" }
      ]
    });
  });

  it("returns an empty state when there is no spending in the selected period", () => {
    expect(
      buildReportViewModel({
        monthlyTotalCents: 0,
        breakdown: [],
        locale: "en-US",
        currency: "USD"
      })
    ).toEqual({
      monthlyTotal: "$0.00",
      rows: [],
      emptyMessage: "No expenses found for this period."
    });
  });
});
