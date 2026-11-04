from typing import Any

from apps.tenants.models import Branch, Tenant
from apps.venues.constants import (
    OrderWorkflow,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
)

VENUE_CAPABILITY_PRESETS: dict[str, dict[str, Any]] = {
    Branch.VenueProfile.QUICK_SERVICE: {
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
    Branch.VenueProfile.CAFE: {
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
    Branch.VenueProfile.CASUAL_DINING: {
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
    Branch.VenueProfile.FINE_DINING: {
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
    Branch.VenueProfile.HOTEL_RESTAURANT: {
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
    Branch.VenueProfile.FOOD_COURT: {
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
    Branch.VenueProfile.BAR_BREWERY: {
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


def get_preset_capabilities(venue_profile: str) -> dict[str, Any]:
    """Retrieve default capabilities dict for a given venue profile."""
    return VENUE_CAPABILITY_PRESETS.get(
        venue_profile,
        VENUE_CAPABILITY_PRESETS[Branch.VenueProfile.CASUAL_DINING],
    ).copy()


# Mapping from informational BusinessType to recommended operational VenueProfile
BUSINESS_TYPE_TO_VENUE_PROFILE: dict[str, str] = {
    Tenant.BusinessType.TEA_SHOP: Branch.VenueProfile.QUICK_SERVICE,
    Tenant.BusinessType.BAKERY: Branch.VenueProfile.QUICK_SERVICE,
    Tenant.BusinessType.CAFE: Branch.VenueProfile.CAFE,
    Tenant.BusinessType.RESTAURANT: Branch.VenueProfile.CASUAL_DINING,
    Tenant.BusinessType.FINE_DINING: Branch.VenueProfile.FINE_DINING,
    Tenant.BusinessType.HOTEL: Branch.VenueProfile.HOTEL_RESTAURANT,
    Tenant.BusinessType.FOOD_COURT: Branch.VenueProfile.FOOD_COURT,
    Tenant.BusinessType.CHAIN: Branch.VenueProfile.CASUAL_DINING,
}


def suggest_venue_profile(business_type: str) -> str:
    """Returns recommended venue profile based on tenant's business type."""
    return BUSINESS_TYPE_TO_VENUE_PROFILE.get(business_type, Branch.VenueProfile.CASUAL_DINING)
