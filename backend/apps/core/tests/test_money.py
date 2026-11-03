from decimal import Decimal

import pytest

from apps.core.money import Money, format_inr


def test_money_initialization():
    m = Money(15000)
    assert m.paise == 15000
    assert m.currency == "INR"


def test_money_rejects_floats():
    with pytest.raises(TypeError, match="Floating point numbers are strictly forbidden"):
        Money(150.50)  # type: ignore[arg-type]

    with pytest.raises(TypeError):
        format_inr(12.34)  # type: ignore[arg-type]

    with pytest.raises(TypeError):
        Money.from_rupees(99.99)  # type: ignore[arg-type]


def test_money_from_rupees():
    m1 = Money.from_rupees("1250.75")
    assert m1.paise == 125075

    m2 = Money.from_rupees(500)
    assert m2.paise == 50000

    m3 = Money.from_rupees(Decimal("10.50"))
    assert m3.paise == 1050


def test_money_to_rupees():
    m = Money(105050)
    assert m.to_rupees() == Decimal("1050.50")


def test_money_arithmetic():
    m1 = Money(1000)
    m2 = Money(2500)

    # Addition
    assert (m1 + m2).paise == 3500

    # Subtraction
    assert (m2 - m1).paise == 1500

    # Multiplication by int
    assert (m1 * 3).paise == 3000
    assert (3 * m1).paise == 3000

    # Multiplication by Decimal
    assert (m1 * Decimal("1.5")).paise == 1500

    # Division
    assert (m2 // 2).paise == 1250

    # Unary operations
    assert (-m1).paise == -1000
    assert abs(-m1).paise == 1000
    assert bool(m1) is True
    assert bool(Money(0)) is False


def test_money_rejects_float_in_operations():
    m = Money(1000)
    with pytest.raises(TypeError):
        _ = m * 1.5  # type: ignore[operator]

    with pytest.raises(TypeError):
        _ = m // 2.0  # type: ignore[operator]


def test_money_comparisons():
    m1 = Money(1000)
    m2 = Money(2000)
    m3 = Money(1000)

    assert m1 < m2
    assert m1 <= m3
    assert m2 > m1
    assert m1 >= m3
    assert m1 == m3
    assert m1 != m2


def test_money_different_currencies():
    m_inr = Money(1000, "INR")
    m_usd = Money(1000, "USD")

    with pytest.raises(ValueError):
        _ = m_inr + m_usd


def test_format_inr():
    assert format_inr(0) == "₹0.00"
    assert format_inr(50) == "₹0.50"
    assert format_inr(100) == "₹1.00"
    assert format_inr(105050) == "₹1,050.50"
    assert format_inr(10000000) == "₹1,00,000.00"
    assert format_inr(123456789) == "₹12,34,567.89"
    assert format_inr(-500) == "-₹5.00"
    assert format_inr(-105050) == "-₹1,050.50"


def test_money_string_representations():
    m = Money(249900)
    assert str(m) == "₹2,499.00"
    assert repr(m) == "Money(249900 paise, currency='INR')"
