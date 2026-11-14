/**
 * ServeMyFood Monetary Utilities (Paise Only - Zero Floating-Point Math)
 * All monetary amounts are stored and processed as whole integer paise (1 INR = 100 paise).
 * Single canonical formatter (formatRupees) and parser (parseRupees).
 */

export function formatRupees(
  paise: number,
  options?: { forceDecimals?: boolean }
): string {
  if (isNaN(paise) || !isFinite(paise) || paise === null || paise === undefined) {
    return options?.forceDecimals === false ? "₹0" : "₹0.00";
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.trunc(paise));

  const rupees = Math.trunc(absPaise / 100);
  const remainderPaise = absPaise % 100;
  const paiseStr = remainderPaise < 10 ? `0${remainderPaise}` : `${remainderPaise}`;

  const rupeesStr = rupees.toString();
  let formattedRupees: string;

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.slice(-3);
    const otherNumbers = rupeesStr.slice(0, -3);
    const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    formattedRupees = `${formattedOthers},${lastThree}`;
  }

  if (options?.forceDecimals === false && remainderPaise === 0) {
    return `${isNegative ? "-" : ""}₹${formattedRupees}`;
  }

  return `${isNegative ? "-" : ""}₹${formattedRupees}.${paiseStr}`;
}

export function parseRupees(
  input: string | number,
  options?: { allowNegative?: boolean; strict?: boolean }
): number {
  const allowNegative = options?.allowNegative ?? true;
  if (typeof input === "number") {
    if (isNaN(input) || !isFinite(input)) return options?.strict ? NaN : 0;
    if (input < 0 && !allowNegative) return options?.strict ? NaN : 0;
    const isNeg = input < 0;
    const absVal = Math.abs(input);
    const intPart = Math.trunc(absVal);
    const decPart = Math.round((absVal - intPart) * 100);
    const total = intPart * 100 + decPart;
    return isNeg ? -total : total;
  }

  if (!input || typeof input !== "string") return options?.strict ? NaN : 0;

  let cleaned = input.trim();
  const isNegative = cleaned.startsWith("-");
  if (isNegative) {
    if (!allowNegative) {
      return options?.strict ? NaN : 0;
    }
    cleaned = cleaned.slice(1).trim();
  }

  // Remove currency symbol, whitespace, and commas
  cleaned = cleaned.replace(/[₹,\s]/g, "");
  if (!cleaned) return 0;

  // Strict check: non-negative integer or decimal with at most 2 decimal places
  if (options?.strict) {
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return NaN;
    }
  } else {
    if (!/^\d+(\.\d+)?$/.test(cleaned)) {
      return NaN;
    }
  }

  const parts = cleaned.split(".");
  const rupeePart = parseInt(parts[0] || "0", 10);
  let paisePart = 0;
  if (parts.length > 1 && parts[1]) {
    if (parts[1].length > 2 && options?.strict) {
      return NaN;
    }
    const dec = (parts[1] + "00").slice(0, 2);
    paisePart = parseInt(dec, 10);
  }

  const totalPaise = rupeePart * 100 + paisePart;
  return isNegative ? -totalPaise : totalPaise;
}

// Canonical Aliases for complete backward compatibility across previous imports
export const formatPaise = (paise: number, options?: { forceDecimals?: boolean }) =>
  formatRupees(paise, { forceDecimals: options?.forceDecimals ?? false });

export const parseRupeesToPaise = (input: string | number) =>
  parseRupees(input, { allowNegative: false, strict: true });
