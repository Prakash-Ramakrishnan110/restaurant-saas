import pytest
from rest_framework.exceptions import ValidationError

from apps.core.context import set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.venues.constants import TableStatus
from apps.venues.services import transition_table_status


@pytest.mark.django_db
def test_allowed_status_transitions(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    table = venue_test_setup["table_a1_1"]
    actor = venue_test_setup["owner_a"]

    # AVAILABLE -> OCCUPIED
    table = transition_table_status(table, TableStatus.OCCUPIED, actor=actor)
    assert table.status == TableStatus.OCCUPIED

    # OCCUPIED -> CLEANING
    table = transition_table_status(table, TableStatus.CLEANING, actor=actor)
    assert table.status == TableStatus.CLEANING

    # CLEANING -> AVAILABLE
    table = transition_table_status(table, TableStatus.AVAILABLE, actor=actor)
    assert table.status == TableStatus.AVAILABLE


@pytest.mark.django_db
def test_disallowed_status_transition_raises_validation_error(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    table = venue_test_setup["table_a1_1"]
    actor = venue_test_setup["owner_a"]

    # AVAILABLE cannot transition directly to CLEANING
    with pytest.raises((ValidationError, BusinessRuleError)) as exc:
        transition_table_status(table, TableStatus.CLEANING, actor=actor)
    assert (
        "CLEANING" in str(exc.value)
        or getattr(exc.value, "error_code", "") == "INVALID_STATUS_TRANSITION"
    )


@pytest.mark.django_db
def test_status_transition_api_endpoint(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["waiter_a1"], venue_test_setup["tenant_a"])
    table = venue_test_setup["table_a1_1"]

    url = f"/api/v1/tables/{table.id}/status/"
    res = client.post(url, {"status": TableStatus.OCCUPIED})
    assert res.status_code == 200
    assert res.data["status"] == TableStatus.OCCUPIED

    # Invalid transition from OCCUPIED to RESERVED returns 400
    res_invalid = client.post(url, {"status": TableStatus.RESERVED})
    assert res_invalid.status_code == 400
