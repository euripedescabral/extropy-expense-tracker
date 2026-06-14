import { describe, expect, it } from "vitest";
import { addCustomCategory, seedDefaultCategories } from "./categoryService";

describe("category service", () => {
  it("seeds stable predefined categories for every new user", () => {
    expect(seedDefaultCategories("user_1")).toEqual([
      { id: "food", userId: "user_1", name: "Food", kind: "system" },
      { id: "transport", userId: "user_1", name: "Transport", kind: "system" },
      { id: "entertainment", userId: "user_1", name: "Entertainment", kind: "system" },
      { id: "utilities", userId: "user_1", name: "Utilities", kind: "system" },
      { id: "health", userId: "user_1", name: "Health", kind: "system" }
    ]);
  });

  it("adds a trimmed custom category without mutating existing categories", () => {
    const existing = seedDefaultCategories("user_1");
    const next = addCustomCategory(existing, {
      userId: "user_1",
      name: "  Books  "
    });

    expect(next).toHaveLength(existing.length + 1);
    expect(next.at(-1)).toMatchObject({
      userId: "user_1",
      name: "Books",
      kind: "custom"
    });
    expect(existing).toHaveLength(5);
  });

  it("rejects duplicate category names case-insensitively per user", () => {
    const existing = seedDefaultCategories("user_1");

    expect(() =>
      addCustomCategory(existing, {
        userId: "user_1",
        name: "food"
      })
    ).toThrow(/duplicate/i);
  });
});
