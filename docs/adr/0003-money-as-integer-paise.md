# ADR 0003: Monetary Values Stored as Integer Paise

## Status
Accepted

## Context
Restaurant software performs thousands of monetary calculations daily: item pricing, bill splitting, discounts, CGST, SGST, service charges, tips, and inventory valuations.
Using IEEE 754 floating-point types (`float`, `double`) introduces binary representation rounding inaccuracies (e.g., `0.1 + 0.2 != 0.3`). Over time, fractional rounding errors accumulate into accounting discrepancies and audit failures.

## Decision
All monetary values in the database and application are strictly represented as **integer paise** (1 INR = 100 paise) stored in `BigIntegerField` database columns.
- Floats are strictly prohibited throughout the codebase; any attempt to pass float to `Money` or `format_inr` raises `TypeError`.
- A dedicated `Money` value object (`apps.core.money.Money`) provides immutable arithmetic, Decimal conversions (`to_rupees()`), and Indian formatting (`format_inr()`).
- Database constraints and serializers validate integer values.

## Consequences
### Positive
- Absolute mathematical precision; zero rounding drift across millions of transactions.
- Fast database indexing and arithmetic in SQL queries.
- Clean and consistent formatting for Indian Rupee notation (e.g., ₹1,050.50, ₹12,34,567.89).

### Negative / Trade-offs
- Developers must remember amounts are in paise (e.g. ₹100 is 10000 paise). Clear property naming (`price_paise`) enforces this.

