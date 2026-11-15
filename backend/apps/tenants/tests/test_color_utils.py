import pytest

from apps.core.exceptions import BusinessRuleError
from apps.tenants.color_utils import (
    parse_hex_color,
    validate_brand_primary_color,
    validate_gstin,
)


def test_color_utils_and_gstin_edge_cases():
    assert parse_hex_color("#abc") == (170, 187, 204)
    with pytest.raises(ValueError):
        parse_hex_color(123)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        parse_hex_color("not-a-color")

    assert validate_brand_primary_color("FF6A00") == "#FF6A00"
    with pytest.raises(BusinessRuleError):
        validate_brand_primary_color("zzzzzz")

    assert validate_gstin("") == ""
    assert validate_gstin("   ") == ""
    assert validate_gstin("33AAAAA0000A1Z5") == "33AAAAA0000A1Z5"
