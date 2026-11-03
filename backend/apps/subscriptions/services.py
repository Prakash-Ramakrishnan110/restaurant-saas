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

    from apps.subscriptions.models import Subscription

    subscription = Subscription.objects.select_related("plan").filter(tenant_id=tenant.id).first()
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


def get_tenant_entitlements_summary(tenant: Any) -> dict[str, Any]:
    """Compile comprehensive entitlements summary with current usage and limits."""
    if not tenant:
        return {}

    from apps.subscriptions.models import Subscription
    from apps.tenants.models import Branch
    from apps.venues.models import DiningTable, ServiceArea

    subscription = Subscription.objects.select_related("plan").filter(tenant_id=tenant.id).first()
    plan_name = subscription.plan.name if subscription and subscription.plan else "Free Trial"
    status_str = subscription.status if subscription else "NONE"

    branch_count = Branch.objects.filter(tenant=tenant, is_active=True).count()
    sa_count = ServiceArea.objects.filter(tenant=tenant).count()
    table_count = DiningTable.objects.filter(tenant=tenant, is_active=True).count()

    max_branches = get_entitlement(tenant, "max_branches", 1)
    max_service_areas = get_entitlement(tenant, "max_service_areas", 1)
    max_tables = get_entitlement(tenant, "max_tables", 15)

    floor_editor = bool(get_entitlement(tenant, "floor_editor", False))
    table_merge = bool(get_entitlement(tenant, "table_merge", False))
    courses = bool(get_entitlement(tenant, "courses", False))

    def calc_remaining(limit_val: int | None, current_val: int) -> int | None:
        if limit_val is None:
            return None
        return max(0, limit_val - current_val)

    return {
        "plan_name": plan_name,
        "status": status_str,
        "limits": {
            "max_branches": {
                "limit": max_branches,
                "current": branch_count,
                "remaining": calc_remaining(max_branches, branch_count),
            },
            "max_service_areas": {
                "limit": max_service_areas,
                "current": sa_count,
                "remaining": calc_remaining(max_service_areas, sa_count),
            },
            "max_tables": {
                "limit": max_tables,
                "current": table_count,
                "remaining": calc_remaining(max_tables, table_count),
            },
            "floor_editor": {"enabled": floor_editor},
            "table_merge": {"enabled": table_merge},
            "courses": {"enabled": courses},
        },
        "usage": {
            "branches": branch_count,
            "service_areas": sa_count,
            "tables": table_count,
        },
    }


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
