from typing import Any

from rest_framework.exceptions import APIException

from apps.subscriptions.constants import ALLOWED_SUBSCRIPTION_STATUSES


class EntitlementLimitReached(APIException):
    status_code = 403
    default_detail = "Entitlement limit reached for your current subscription plan."
    default_code = "ENTITLEMENT_LIMIT_REACHED"


def is_tenant_allowed(tenant: Any) -> bool:
    """Service gate verifying if a tenant is allowed to operate."""
    if tenant is None:
        return False

    from apps.tenants.models import Tenant

    if getattr(tenant, "status", None) != Tenant.Status.ACTIVE:
        return False

    subscription = getattr(tenant, "subscription", None)
    if subscription is not None:
        return subscription.status in ALLOWED_SUBSCRIPTION_STATUSES

    return True


def get_entitlement(tenant: Any, key: str, default: Any = None) -> Any:
    """Retrieve an entitlement limit or feature flag for a tenant's subscription plan."""
    if not tenant:
        return default

    subscription = getattr(tenant, "subscription", None)
    if not subscription or not subscription.plan:
        # Default fallback limits if no plan attached
        default_limits = {
            "max_branches": 1,
            "max_service_areas": 1,
            "max_tables": 15,
            "floor_editor": False,
            "table_merge": False,
            "courses": False,
        }
        return default_limits.get(key, default)

    entitlements = getattr(subscription.plan, "entitlements", {}) or {}
    return entitlements.get(key, default)


def enforce_limit(tenant: Any, key: str, current_count: int | None = None) -> None:
    """Enforces plan entitlement limits.

    Raises EntitlementLimitReached if limit is exceeded or feature is disabled.
    """
    if not tenant:
        return

    limit = get_entitlement(tenant, key)
    if limit is None:
        return

    # Boolean feature flag check (e.g., courses: false, table_merge: false)
    if isinstance(limit, bool):
        if not limit:
            raise EntitlementLimitReached(
                f"Feature '{key}' is not available on your current subscription plan."
            )
        return

    # Numeric limit check (e.g., max_tables, max_service_areas)
    if isinstance(limit, int | float) and current_count is not None:
        if current_count >= limit:
            raise EntitlementLimitReached(
                f"Entitlement limit reached for '{key}' (Current: {current_count}, Max: {limit})."
            )
