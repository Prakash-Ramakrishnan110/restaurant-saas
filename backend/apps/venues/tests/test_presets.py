from typing import Any

import pytest
from django.apps import apps as django_apps

from apps.core.context import set_current_tenant
from apps.tenants.models import Branch
from apps.venues.constants import (
    OrderWorkflow,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
)
from apps.venues.models import BranchCapabilities
from apps.venues.presets import VENUE_CAPABILITY_PRESETS, get_preset_capabilities
from apps.venues.services import apply_preset, validate_capabilities


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
def test_golden_table_all_seven_presets_15_fields():
    """Asserts that all 7 presets have all 15 capability fields exactly matching the golden specification."""
    expected_fields = {
        "uses_tables",
        "uses_token_numbers",
        "uses_kds",
        "supports_courses",
        "allows_takeaway",
        "allows_room_service",
        "allows_room_charge",
        "has_sections",
        "has_seat_ordering",
        "allows_table_transfer",
        "allows_qr_ordering",
        "payment_timing",
        "qr_ordering_mode",
        "qr_session_policy",
        "order_workflow",
    }
    assert len(expected_fields) == 15

    golden_matrix: dict[str, dict[str, Any]] = {
        str(Branch.VenueProfile.QUICK_SERVICE): {
            "uses_tables": False,
            "uses_token_numbers": True,
            "uses_kds": False,
            "supports_courses": False,
            "allows_takeaway": True,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": False,
            "has_seat_ordering": False,
            "allows_table_transfer": False,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_FIRST,
            "qr_ordering_mode": QROrderingMode.BROWSE_ONLY,
            "qr_session_policy": QRSessionPolicy.CUSTOMER_CAN_OPEN,
            "order_workflow": OrderWorkflow.COUNTER_TOKEN,
        },
        str(Branch.VenueProfile.CAFE): {
            "uses_tables": True,
            "uses_token_numbers": False,
            "uses_kds": False,
            "supports_courses": False,
            "allows_takeaway": True,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": False,
            "has_seat_ordering": False,
            "allows_table_transfer": True,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.EITHER,
            "qr_ordering_mode": QROrderingMode.ORDER_DIRECT,
            "qr_session_policy": QRSessionPolicy.CUSTOMER_CAN_OPEN,
            "order_workflow": OrderWorkflow.TABLE_SERVICE,
        },
        str(Branch.VenueProfile.CASUAL_DINING): {
            "uses_tables": True,
            "uses_token_numbers": False,
            "uses_kds": True,
            "supports_courses": False,
            "allows_takeaway": True,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": True,
            "has_seat_ordering": False,
            "allows_table_transfer": True,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_LATER,
            "qr_ordering_mode": QROrderingMode.ORDER_WITH_APPROVAL,
            "qr_session_policy": QRSessionPolicy.CUSTOMER_CAN_OPEN,
            "order_workflow": OrderWorkflow.TABLE_SERVICE,
        },
        str(Branch.VenueProfile.FINE_DINING): {
            "uses_tables": True,
            "uses_token_numbers": False,
            "uses_kds": True,
            "supports_courses": True,
            "allows_takeaway": False,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": True,
            "has_seat_ordering": True,
            "allows_table_transfer": True,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_LATER,
            "qr_ordering_mode": QROrderingMode.BROWSE_ONLY,
            "qr_session_policy": QRSessionPolicy.STAFF_ONLY,
            "order_workflow": OrderWorkflow.TABLE_SERVICE,
        },
        str(Branch.VenueProfile.HOTEL_RESTAURANT): {
            "uses_tables": True,
            "uses_token_numbers": False,
            "uses_kds": True,
            "supports_courses": True,
            "allows_takeaway": True,
            "allows_room_service": True,
            "allows_room_charge": True,
            "has_sections": True,
            "has_seat_ordering": True,
            "allows_table_transfer": True,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_LATER,
            "qr_ordering_mode": QROrderingMode.ORDER_WITH_APPROVAL,
            "qr_session_policy": QRSessionPolicy.STAFF_ONLY,
            "order_workflow": OrderWorkflow.TABLE_SERVICE,
        },
        str(Branch.VenueProfile.FOOD_COURT): {
            "uses_tables": False,
            "uses_token_numbers": True,
            "uses_kds": True,
            "supports_courses": False,
            "allows_takeaway": True,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": False,
            "has_seat_ordering": False,
            "allows_table_transfer": False,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_FIRST,
            "qr_ordering_mode": QROrderingMode.ORDER_DIRECT,
            "qr_session_policy": QRSessionPolicy.CUSTOMER_CAN_OPEN,
            "order_workflow": OrderWorkflow.COUNTER_TOKEN,
        },
        str(Branch.VenueProfile.BAR_BREWERY): {
            "uses_tables": True,
            "uses_token_numbers": False,
            "uses_kds": True,
            "supports_courses": False,
            "allows_takeaway": False,
            "allows_room_service": False,
            "allows_room_charge": False,
            "has_sections": True,
            "has_seat_ordering": False,
            "allows_table_transfer": True,
            "allows_qr_ordering": True,
            "payment_timing": PaymentTiming.PAY_LATER,
            "qr_ordering_mode": QROrderingMode.ORDER_WITH_APPROVAL,
            "qr_session_policy": QRSessionPolicy.CUSTOMER_CAN_OPEN,
            "order_workflow": OrderWorkflow.BAR_TAB,
        },
    }

    assert len(VENUE_CAPABILITY_PRESETS) == 7
    for profile, preset in VENUE_CAPABILITY_PRESETS.items():
        assert set(preset.keys()) == expected_fields, f"{profile} has incorrect capability fields"
        assert preset == golden_matrix[profile], f"{profile} does not match golden preset values"


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
    assert fd_preset["supports_courses"] is True
    assert fd_preset["allows_takeaway"] is False
    assert fd_preset["qr_session_policy"] == QRSessionPolicy.STAFF_ONLY


@pytest.mark.django_db
def test_hotel_preset_values():
    hotel_preset = get_preset_capabilities(Branch.VenueProfile.HOTEL_RESTAURANT)
    assert hotel_preset["allows_room_service"] is True
    assert hotel_preset["payment_timing"] == PaymentTiming.PAY_LATER
    assert hotel_preset["allows_room_charge"] is True


@pytest.mark.django_db
def test_all_presets_pass_validation():
    for _profile, preset in VENUE_CAPABILITY_PRESETS.items():
        # Every preset must pass R1-R7 validation without raising
        validate_capabilities(preset)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "rule_id,invalid_payload,expected_fields",
    [
        (
            "R1",
            {"order_workflow": OrderWorkflow.COUNTER_TOKEN, "uses_token_numbers": False},
            {"order_workflow", "uses_token_numbers"},
        ),
        (
            "R2",
            {
                "order_workflow": OrderWorkflow.TABLE_SERVICE,
                "uses_tables": False,
                "has_sections": False,
                "has_seat_ordering": False,
                "supports_courses": False,
            },
            {"order_workflow", "uses_tables"},
        ),
        (
            "R3",
            {"order_workflow": OrderWorkflow.ROOM_SERVICE, "allows_room_service": False},
            {"order_workflow", "allows_room_service"},
        ),
        (
            "R4",
            {
                "order_workflow": OrderWorkflow.BAR_TAB,
                "supports_courses": True,
                "uses_tables": False,
                "has_sections": False,
                "has_seat_ordering": False,
            },
            {"supports_courses", "uses_tables"},
        ),
        (
            "R5_sections",
            {
                "order_workflow": OrderWorkflow.BAR_TAB,
                "has_sections": True,
                "uses_tables": False,
                "has_seat_ordering": False,
                "supports_courses": False,
            },
            {"has_sections", "uses_tables"},
        ),
        (
            "R5_seats",
            {
                "order_workflow": OrderWorkflow.BAR_TAB,
                "has_seat_ordering": True,
                "uses_tables": False,
                "has_sections": False,
                "supports_courses": False,
            },
            {"has_seat_ordering", "uses_tables"},
        ),
        (
            "R6",
            {"allows_room_charge": True, "payment_timing": PaymentTiming.PAY_FIRST},
            {"allows_room_charge", "payment_timing"},
        ),
        (
            "R7_approval",
            {"qr_ordering_mode": QROrderingMode.ORDER_WITH_APPROVAL, "allows_qr_ordering": False},
            {"qr_ordering_mode", "allows_qr_ordering"},
        ),
        (
            "R7_direct",
            {"qr_ordering_mode": QROrderingMode.ORDER_DIRECT, "allows_qr_ordering": False},
            {"qr_ordering_mode", "allows_qr_ordering"},
        ),
    ],
)
def test_patch_capabilities_rejects_invalid_combinations(
    venue_test_setup, rule_id, invalid_payload, expected_fields
):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]

    res = client.patch(
        f"/api/v1/branches/{branch.id}/capabilities/",
        invalid_payload,
        format="json",
    )
    assert res.status_code == 400, f"Rule {rule_id} should have failed with 400"
    assert res.data["error"]["code"] == "INVALID_CAPABILITY_COMBINATION"
    details = res.data["error"]["details"]
    for field in expected_fields:
        assert field in details, f"Rule {rule_id} missing offending field '{field}' in details"


@pytest.mark.django_db
def test_migration_remaps_legacy_qr_ordering_modes_and_payment_timing(venue_test_setup):
    """Proves migration 0005 converts legacy qr_ordering_mode and payment_timing values."""
    import importlib

    mig_0005 = importlib.import_module(
        "apps.venues.migrations.0005_branchcapabilities_allows_room_charge_and_more"
    )
    remap_capabilities = mig_0005.remap_capabilities

    tenant = venue_test_setup["tenant_a"]
    set_current_tenant(tenant)

    b_a1 = venue_test_setup["branch_a1"]
    b_a2 = venue_test_setup["branch_a2"]
    b_b1 = venue_test_setup["branch_b1"]

    cap1 = BranchCapabilities.unscoped.get(branch=b_a1)
    cap2 = BranchCapabilities.unscoped.get(branch=b_a2)
    cap3 = BranchCapabilities.unscoped.get(branch=b_b1)

    # Set legacy values via queryset update (bypassing choice validation)
    BranchCapabilities.unscoped.filter(pk=cap1.pk).update(
        payment_timing="ROOM_CHARGE",
        allows_room_charge=False,
        qr_ordering_mode="ORDER_PAY_LATER",
    )
    BranchCapabilities.unscoped.filter(pk=cap2.pk).update(
        payment_timing="TAB",
        qr_ordering_mode="ORDER_PAY_FIRST",
    )
    BranchCapabilities.unscoped.filter(pk=cap3.pk).update(
        qr_ordering_mode="DIRECT_TO_KITCHEN",
    )

    remap_capabilities(django_apps, None)

    cap1.refresh_from_db()
    cap2.refresh_from_db()
    cap3.refresh_from_db()

    assert cap1.payment_timing == PaymentTiming.PAY_LATER
    assert cap1.allows_room_charge is True
    assert cap1.qr_ordering_mode == QROrderingMode.ORDER_WITH_APPROVAL

    assert cap2.payment_timing == PaymentTiming.PAY_LATER
    assert cap2.qr_ordering_mode == QROrderingMode.ORDER_DIRECT

    assert cap3.qr_ordering_mode == QROrderingMode.ORDER_DIRECT


@pytest.mark.django_db
def test_apply_preset_creates_or_updates_capabilities(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    capabilities = apply_preset(branch, Branch.VenueProfile.FINE_DINING)
    assert capabilities.supports_courses is True
    assert capabilities.allows_takeaway is False

    # Check persistence
    db_caps = BranchCapabilities.objects.get(branch=branch)
    assert db_caps.supports_courses is True
    assert db_caps.allows_takeaway is False


@pytest.mark.django_db
def test_presets_api_endpoint(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    response = client.get("/api/v1/venues/presets/")
    assert response.status_code == 200
    assert Branch.VenueProfile.CASUAL_DINING in response.data
    assert len(response.data) == 7


@pytest.mark.django_db
def test_partial_capability_patch_validated_on_merged_state(venue_test_setup):
    """Test that a partial PATCH to branch capabilities validates invariant rules on the MERGED state."""
    from apps.venues.tests.conftest import make_client

    tenant = venue_test_setup["tenant_a"]
    owner = venue_test_setup["owner_a"]
    branch = venue_test_setup["branch_a1"]

    set_current_tenant(tenant)
    # Apply QUICK_SERVICE: order_workflow=COUNTER_TOKEN, uses_token_numbers=True, uses_tables=False
    apply_preset(branch, Branch.VenueProfile.QUICK_SERVICE)
    client = make_client(owner, tenant)

    # 1. Partial PATCH: attempt to turn off uses_token_numbers while order_workflow remains COUNTER_TOKEN
    # This must fail R1 on merged state
    res_fail = client.patch(
        f"/api/v1/branches/{branch.id}/capabilities/",
        {"uses_token_numbers": False},
        format="json",
    )
    assert res_fail.status_code == 400
    assert res_fail.data["error"]["code"] == "INVALID_CAPABILITY_COMBINATION"
    assert "uses_token_numbers" in str(res_fail.data["error"]["details"])

    # 2. Valid partial PATCH: toggle allows_takeaway
    res_ok = client.patch(
        f"/api/v1/branches/{branch.id}/capabilities/",
        {"allows_takeaway": False},
        format="json",
    )
    assert res_ok.status_code == 200
    assert res_ok.data["allows_takeaway"] is False
    # Ensure other merged fields remained intact
    assert res_ok.data["order_workflow"] == OrderWorkflow.COUNTER_TOKEN
    assert res_ok.data["uses_token_numbers"] is True
