/**
 * Currency utility using pure integer arithmetic and Indian numbering system formatting.
 * NO floating-point calculations or float rounding are allowed on monetary values.
 */

export function formatRupees(paise: number): string {
  if (isNaN(paise) || !isFinite(paise)) {
    return "₹0.00";
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

  return `${isNegative ? "-" : ""}₹${formattedRupees}.${paiseStr}`;
}

export function parseRupees(text: string): number {
  if (!text) return 0;

  let cleaned = text.trim();
  const isNegative = cleaned.startsWith("-");
  if (isNegative) {
    cleaned = cleaned.slice(1).trim();
  }

  // Remove currency symbol, spaces, and commas
  cleaned = cleaned.replace(/[₹\s,]/g, "");
  if (!cleaned) return 0;

  const parts = cleaned.split(".");
  const rupeePart = parts[0] || "0";
  const paisePart = parts.length > 1 ? parts[1] : "00";

  const rupees = parseInt(rupeePart, 10) || 0;
  // Pad or truncate paise part to exactly 2 digits
  const paddedPaise = (paisePart + "00").slice(0, 2);
  const paise = parseInt(paddedPaise, 10) || 0;

  const totalPaise = rupees * 100 + paise;
  return isNegative ? -totalPaise : totalPaise;
}
