from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any


class Money:
    """Immutable money value object handling amounts strictly as integer paise (1 INR = 100 paise).

    Prevents floating point precision bugs by rejecting float arguments.
    """

    __slots__ = ("_paise", "_currency")
    _paise: int
    _currency: str

    def __init__(self, paise: int, currency: str = "INR") -> None:
        if isinstance(paise, float):
            raise TypeError(
                "Floating point numbers are strictly forbidden for Money. Use integer paise."
            )
        if not isinstance(paise, int):
            raise TypeError(f"Paise amount must be an integer, got {type(paise).__name__}")
        object.__setattr__(self, "_paise", paise)
        object.__setattr__(self, "_currency", currency)

    @property
    def paise(self) -> int:
        return self._paise

    @property
    def currency(self) -> str:
        return self._currency

    def to_rupees(self) -> Decimal:
        """Return rupee representation as a Decimal with 2 decimal places."""
        return (Decimal(self._paise) / Decimal(100)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @classmethod
    def from_rupees(cls, rupees: int | str | Decimal, currency: str = "INR") -> Money:
        """Create a Money object from rupees.

        Rejects float types strictly.
        """
        if isinstance(rupees, float):
            raise TypeError(
                "Floating point numbers are forbidden for Money. Pass Decimal, str, or int."
            )
        dec = Decimal(str(rupees))
        paise = int((dec * Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return cls(paise=paise, currency=currency)

    def format_inr(self) -> str:
        return format_inr(self._paise)

    def __repr__(self) -> str:
        return f"Money({self._paise} paise, currency='{self._currency}')"

    def __str__(self) -> str:
        return self.format_inr()

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, Money):
            return self._paise == other._paise and self._currency == other._currency
        return False

    def __lt__(self, other: Money) -> bool:
        self._ensure_same_currency(other)
        return self._paise < other._paise

    def __le__(self, other: Money) -> bool:
        self._ensure_same_currency(other)
        return self._paise <= other._paise

    def __gt__(self, other: Money) -> bool:
        self._ensure_same_currency(other)
        return self._paise > other._paise

    def __ge__(self, other: Money) -> bool:
        self._ensure_same_currency(other)
        return self._paise >= other._paise

    def __add__(self, other: Money) -> Money:
        self._ensure_same_currency(other)
        return Money(self._paise + other._paise, self._currency)

    def __sub__(self, other: Money) -> Money:
        self._ensure_same_currency(other)
        return Money(self._paise - other._paise, self._currency)

    def __mul__(self, scalar: int | Decimal) -> Money:
        if isinstance(scalar, float):
            raise TypeError("Cannot multiply Money by float. Use int or Decimal.")
        if isinstance(scalar, int):
            return Money(self._paise * scalar, self._currency)
        if isinstance(scalar, Decimal):
            new_paise = int(
                (Decimal(self._paise) * scalar).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
            return Money(new_paise, self._currency)
        raise TypeError(f"Cannot multiply Money by {type(scalar).__name__}")

    def __rmul__(self, scalar: int | Decimal) -> Money:
        return self.__mul__(scalar)

    def __floordiv__(self, divisor: int) -> Money:
        if isinstance(divisor, float):
            raise TypeError("Cannot divide Money by float. Use int.")
        if not isinstance(divisor, int):
            raise TypeError(f"Divisor must be int, got {type(divisor).__name__}")
        if divisor == 0:
            raise ZeroDivisionError("division by zero")
        return Money(self._paise // divisor, self._currency)

    def __neg__(self) -> Money:
        return Money(-self._paise, self._currency)

    def __pos__(self) -> Money:
        return self

    def __abs__(self) -> Money:
        return Money(abs(self._paise), self._currency)

    def __bool__(self) -> bool:
        return self._paise != 0

    def _ensure_same_currency(self, other: Any) -> None:
        if not isinstance(other, Money):
            raise TypeError(f"Operand must be Money, got {type(other).__name__}")
        if self._currency != other._currency:
            raise ValueError(
                f"Cannot perform operation on different currencies: {self._currency} and {other._currency}"
            )


def format_inr(paise: int) -> str:
    """Format integer paise into Indian Rupee string (e.g., 105050 -> ₹1,050.50, 10000000 -> ₹1,00,000.00).

    Uses the Indian numbering grouping (lakhs, crores).
    """
    if isinstance(paise, float):
        raise TypeError("paise must be an integer, not float")
    if not isinstance(paise, int):
        raise TypeError(f"paise must be an integer, got {type(paise).__name__}")

    is_negative = paise < 0
    abs_paise = abs(paise)
    rupees = abs_paise // 100
    rem_paise = abs_paise % 100

    rupee_str = str(rupees)
    if len(rupee_str) <= 3:
        formatted_rupees = rupee_str
    else:
        last_three = rupee_str[-3:]
        remaining = rupee_str[:-3]
        # Group the remaining digits into pairs of 2 from right to left
        pairs = []
        while remaining:
            pairs.append(remaining[-2:])
            remaining = remaining[:-2]
        pairs.reverse()
        formatted_rupees = ",".join(pairs) + "," + last_three

    result = f"₹{formatted_rupees}.{rem_paise:02d}"
    return f"-{result}" if is_negative else result
