import pytest

from apps.core.context import set_current_tenant
from apps.tenants.models import Branch
from apps.venues.constants import (
    OrderWorkflow,
    PaymentTiming,
    QRSessionPolicy,
)
from apps.venues.models import BranchCapabilities
from apps.venues.presets import VENUE_CAPABILITY_PRESETS, get_preset_capabilities
from apps.venues.services import apply_preset


@pytest.mark.django_db
def test_all_seven_presets_exist():
    expected_profiles = {
        Branch.VenueProfile.QUICK_SERVICE,
        Branch.VenueProfile.CAFE,
        Branch.VenueProfile.CASUAL_DINING,
        Branch.VenueProfile.FINE_DINING,
        Branch.VenueProfile.HOTEL_RESTAURANT,
        Branch.VenueProfile.FOOD_COURT,
        Branch.VenueProfile.BAR_BREWERY,
    }
    assert set(VENUE_CAPABILITY_PRESETS.keys()) == expected_profiles


@pytest.mark.django_db
def test_quick_service_preset_values():
    qs_preset = get_preset_capabilities(Branch.VenueProfile.QUICK_SERVICE)
    assert qs_preset["uses_tables"] is False
    assert qs_preset["uses_token_numbers"] is True
    assert qs_preset["payment_timing"] == PaymentTiming.PAY_FIRST
    assert qs_preset["order_workflow"] == OrderWorkflow.COUNTER_TOKEN


@pytest.mark.django_db
def test_fine_dining_preset_values():
    fd_preset = get_preset_capabilities(Branch.VenueProfile.FINE_DINING)
    assert fd_preset["uses_tables"] is True
    assert fd_preset["uses_courses"] is True
    assert fd_preset["allows_takeaway"] is False
    assert fd_preset["qr_session_policy"] == QRSessionPolicy.STAFF_ONLY


@pytest.mark.django_db
def test_hotel_preset_values():
    hotel_preset = get_preset_capabilities(Branch.VenueProfile.HOTEL_RESTAURANT)
    assert hotel_preset["allows_room_service"] is True
    assert hotel_preset["payment_timing"] == PaymentTiming.ROOM_CHARGE


@pytest.mark.django_db
def test_apply_preset_creates_or_updates_capabilities(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    capabilities = apply_preset(branch, Branch.VenueProfile.FINE_DINING)
    assert capabilities.uses_courses is True
    assert capabilities.allows_takeaway is False

    # Check persistence
    db_caps = BranchCapabilities.objects.get(branch=branch)
    assert db_caps.uses_courses is True
    assert db_caps.allows_takeaway is False


@pytest.mark.django_db
def test_presets_api_endpoint(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    response = client.get("/api/v1/venues/presets/")
    assert response.status_code == 200
    assert Branch.VenueProfile.CASUAL_DINING in response.data
    assert len(response.data) == 7
