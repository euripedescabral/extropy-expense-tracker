import { describe, expect, it } from "vitest";
import { formatMoneyInputValue, normalizeMoneyInputValue } from "./moneyInput";

describe("money input masking", () => {
  it("formats decimal money input with currency symbol, grouping, and cents", () => {
    expect(formatMoneyInputValue("1200")).toBe("$1,200.00");
    expect(formatMoneyInputValue("1200.5")).toBe("$1,200.50");
    expect(formatMoneyInputValue("1200.567")).toBe("$1,200.56");
  });

  it("normalizes masked values back to decimal payloads", () => {
    expect(normalizeMoneyInputValue("$1,200.50")).toBe("1200.50");
    expect(normalizeMoneyInputValue("2500")).toBe("2500.00");
    expect(normalizeMoneyInputValue("$0.99")).toBe("0.99");
  });

  it("keeps empty or invalid money input empty instead of producing NaN", () => {
    expect(formatMoneyInputValue("")).toBe("");
    expect(formatMoneyInputValue("abc")).toBe("");
    expect(normalizeMoneyInputValue("abc")).toBe("");
  });
});
