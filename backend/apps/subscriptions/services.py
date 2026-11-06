from typing import Any

from apps.core.exceptions import BusinessRuleError
from apps.subscriptions.constants import ALLOWED_SUBSCRIPTION_STATUSES


class EntitlementLimitReached(BusinessRuleError):
    """Raised when a plan limit is hit; details = {limit_key, limit, current, requested}."""

    def __init__(
        self,
        message: str = "Entitlement limit reached for your current subscription plan.",
        *,
        limit_key: str = "",
        limit: Any = None,
        current: int | None = None,
        requested: int | None = None,
    ) -> None:
        details = {"limit_key": limit_key, "limit": limit, "current": current}
        if requested is not None:
            details["requested"] = requested
        super().__init__(
            "ENTITLEMENT_LIMIT_REACHED",
            message,
            status_code=403,
            details=details,
        )


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
            "max_menu_items": 100,
            "max_image_storage_mb": 50,
            "floor_editor": False,
            "table_merge": False,
            "courses": False,
        }
        return default_limits.get(key, default)

    entitlements = getattr(subscription.plan, "entitlements", {}) or {}
    value = entitlements.get(key, default)
    # A negative numeric limit (e.g. -1) means "unlimited".
    if isinstance(value, int) and not isinstance(value, bool) and value < 0:
        return None
    return value


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

    try:
        from django.db.models import Sum

        from apps.menu.models import MenuItem

        menu_item_count = MenuItem.objects.filter(tenant=tenant).count()
        img_bytes = (
            MenuItem.objects.filter(tenant=tenant).aggregate(total=Sum("image_bytes"))["total"] or 0
        )
        img_mb = round(img_bytes / (1024 * 1024), 2)
    except Exception:
        menu_item_count = 0
        img_mb = 0.0

    max_branches = get_entitlement(tenant, "max_branches", 1)
    max_service_areas = get_entitlement(tenant, "max_service_areas", 1)
    max_tables = get_entitlement(tenant, "max_tables", 15)
    max_menu_items = get_entitlement(tenant, "max_menu_items", 100)
    max_image_storage_mb = get_entitlement(tenant, "max_image_storage_mb", 50)

    floor_editor = bool(get_entitlement(tenant, "floor_editor", False))
    table_merge = bool(get_entitlement(tenant, "table_merge", False))
    courses = bool(get_entitlement(tenant, "courses", False))

    def calc_remaining(limit_val: int | None, current_val: int) -> int | None:
        if limit_val is None:
            return None
        return max(0, limit_val - current_val)

    def is_over(limit_val: int | None, current_val: int) -> bool:
        return limit_val is not None and current_val > limit_val

    return {
        "plan_name": plan_name,
        "status": status_str,
        "limits": {
            "max_branches": {
                "limit": max_branches,
                "current": branch_count,
                "remaining": calc_remaining(max_branches, branch_count),
                "over_limit": is_over(max_branches, branch_count),
            },
            "max_service_areas": {
                "limit": max_service_areas,
                "current": sa_count,
                "remaining": calc_remaining(max_service_areas, sa_count),
                "over_limit": is_over(max_service_areas, sa_count),
            },
            "max_tables": {
                "limit": max_tables,
                "current": table_count,
                "remaining": calc_remaining(max_tables, table_count),
                "over_limit": is_over(max_tables, table_count),
            },
            "max_menu_items": {
                "limit": max_menu_items,
                "current": menu_item_count,
                "remaining": calc_remaining(max_menu_items, menu_item_count),
                "over_limit": is_over(max_menu_items, menu_item_count),
            },
            "max_image_storage_mb": {
                "limit": max_image_storage_mb,
                "current": img_mb,
                "remaining": calc_remaining(max_image_storage_mb, int(img_mb)),
                "over_limit": is_over(max_image_storage_mb, int(img_mb)),
            },
            "floor_editor": {"enabled": floor_editor},
            "table_merge": {"enabled": table_merge},
            "courses": {"enabled": courses},
        },
        "usage": {
            "branches": branch_count,
            "service_areas": sa_count,
            "tables": table_count,
            "menu_items": menu_item_count,
            "image_storage_mb": img_mb,
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
                f"Feature '{key}' is not available on your current subscription plan.",
                limit_key=key,
                limit=False,
                current=None,
            )
        return

    # Numeric limit check (e.g., max_tables, max_service_areas)
    if isinstance(limit, int | float) and current_count is not None:
        if current_count >= limit:
            raise EntitlementLimitReached(
                f"Entitlement limit reached for '{key}' (Current: {current_count}, Max: {limit}).",
                limit_key=key,
                limit=limit,
                current=current_count,
            )
