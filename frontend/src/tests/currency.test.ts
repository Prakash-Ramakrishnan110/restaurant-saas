import { describe, expect, it } from "vitest";
import { formatRupees, parseRupees } from "../utils/currency";

describe("currency utilities - integer math only", () => {
  it("formats integer paise using Indian grouping", () => {
    expect(formatRupees(0)).toBe("₹0.00");
    expect(formatRupees(5)).toBe("₹0.05");
    expect(formatRupees(100)).toBe("₹1.00");
    expect(formatRupees(12345)).toBe("₹123.45");
    expect(formatRupees(12500000)).toBe("₹1,25,000.00");
    expect(formatRupees(-5000)).toBe("-₹50.00");
  });

  it("parses rupee strings to integer paise without floating point error", () => {
    expect(parseRupees("₹0.00")).toBe(0);
    expect(parseRupees("₹0.05")).toBe(5);
    expect(parseRupees("₹1.00")).toBe(100);
    expect(parseRupees("₹123.45")).toBe(12345);
    expect(parseRupees("₹1,25,000.00")).toBe(12500000);
    expect(parseRupees("125000")).toBe(12500000);
    expect(parseRupees("-₹50.00")).toBe(-5000);
  });
});
