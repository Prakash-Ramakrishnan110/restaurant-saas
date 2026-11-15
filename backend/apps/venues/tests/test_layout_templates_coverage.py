import pytest

from apps.core.exceptions import BusinessRuleError
from apps.venues.layout_templates import build_template_spec


def test_build_template_spec_fine_dining_and_hotel():
    fine = build_template_spec("fine_dining")
    assert fine["summary"]["tables_count"] == 20

    hotel = build_template_spec("hotel", {"floors": 2, "rooms_per_floor": 4})
    assert hotel["summary"]["areas_count"] >= 3

    with pytest.raises(BusinessRuleError):
        build_template_spec("hotel", {"floors": 11})

    with pytest.raises(BusinessRuleError):
        build_template_spec("hotel", {"floors": 2, "rooms_per_floor": 45})


def test_build_template_spec_counters_and_errors():
    counters = build_template_spec("counters", {"count": 2, "names": "not-a-list"})
    assert counters["summary"]["counters_count"] == 2

    with pytest.raises(BusinessRuleError):
        build_template_spec("counters", {"count": 15})

    with pytest.raises(BusinessRuleError):
        build_template_spec("nonexistent_template")
