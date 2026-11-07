from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.menu.constants import FoodType
from apps.menu.models import (
    MenuCategory,
    MenuItem,
    OptionGroup,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant


@pytest.fixture
def rbac_matrix_env():
    tenant = Tenant.objects.create(
        name="RBAC Matrix Diner", slug="rbac-diner", status=Tenant.Status.ACTIVE
    )
    plan = Plan.objects.create(
        name="Pro Plan", slug="pro-rbac", entitlements={"max_menu_items": 100}
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.objects.create(tenant=tenant, name="Main Branch")

    cat = MenuCategory.objects.create(tenant=tenant, name="Desserts", sort_order=1)
    item = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Gulab Jamun",
        base_price_paise=15000,
        food_type=FoodType.VEG,
    )
    opt_grp = OptionGroup.objects.create(
        tenant=tenant,
        name="Portion",
        min_select=1,
        max_select=1,
    )

    roles = [
        Role.OWNER,
        Role.BRANCH_MANAGER,
        Role.CASHIER,
        Role.WAITER,
        Role.KITCHEN,
        Role.INVENTORY_MANAGER,
    ]
    users_by_role = {}
    for role in roles:
        u = User.objects.create_user(
            email=f"{role.lower()}@rbac-test.com",
            password="Password123!",
            full_name=f"Test {role.title()}",
        )
        Membership.objects.create(user=u, tenant=tenant, role=role, is_active=True)
        users_by_role[role] = u

    return {
        "tenant": tenant,
        "branch": branch,
        "category": cat,
        "item": item,
        "option_group": opt_grp,
        "users": users_by_role,
    }


def make_role_client(user, tenant):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    client.defaults["HTTP_X_TENANT_ID"] = str(tenant.id)
    return client


# 25 endpoints/actions across 6 roles = 150 test cases
ENDPOINTS: list[tuple[str, str, str, Any, str]] = [
    # (action_name, method, url_template, payload, expected_manage, expected_avail, expected_view)
    ("category_list", "GET", "/api/v1/menu/categories/", None, "view"),
    ("category_create", "POST", "/api/v1/menu/categories/", {"name": "New Cat"}, "manage"),
    ("category_retrieve", "GET", "/api/v1/menu/categories/{cat_id}/", None, "view"),
    (
        "category_update",
        "PATCH",
        "/api/v1/menu/categories/{cat_id}/",
        {"name": "Updated Cat"},
        "manage",
    ),
    ("category_reorder", "POST", "/api/v1/menu/categories/reorder/", {"orders": []}, "manage"),
    ("category_destroy", "DELETE", "/api/v1/menu/categories/{cat_id}/", None, "manage"),
    ("item_list", "GET", "/api/v1/menu/items/", None, "view"),
    (
        "item_create",
        "POST",
        "/api/v1/menu/items/",
        {"name": "New Item", "base_price_paise": 10000, "category": "{cat_id}"},
        "manage",
    ),
    ("item_retrieve", "GET", "/api/v1/menu/items/{item_id}/", None, "view"),
    ("item_update", "PATCH", "/api/v1/menu/items/{item_id}/", {"name": "Updated Item"}, "manage"),
    ("item_variants", "PUT", "/api/v1/menu/items/{item_id}/variants/", {"variants": []}, "manage"),
    (
        "item_option_groups",
        "PUT",
        "/api/v1/menu/items/{item_id}/option-groups/",
        {"group_ids": []},
        "manage",
    ),
    ("item_bulk_create", "POST", "/api/v1/menu/items/bulk-create/", {"items": []}, "manage"),
    ("item_image_upload", "POST", "/api/v1/menu/items/{item_id}/image/", {}, "manage"),
    ("item_image_delete", "DELETE", "/api/v1/menu/items/{item_id}/image/", None, "manage"),
    ("item_destroy", "DELETE", "/api/v1/menu/items/{item_id}/", None, "manage"),
    ("option_group_list", "GET", "/api/v1/menu/option-groups/", None, "view"),
    (
        "option_group_create",
        "POST",
        "/api/v1/menu/option-groups/",
        {"name": "Spice", "min_select": 0, "max_select": 1},
        "manage",
    ),
    ("option_group_retrieve", "GET", "/api/v1/menu/option-groups/{og_id}/", None, "view"),
    (
        "option_group_update",
        "PATCH",
        "/api/v1/menu/option-groups/{og_id}/",
        {"name": "Spice Level"},
        "manage",
    ),
    ("option_group_destroy", "DELETE", "/api/v1/menu/option-groups/{og_id}/", None, "manage"),
    ("availability_list", "GET", "/api/v1/menu/availability/", None, "avail"),
    (
        "availability_toggle",
        "POST",
        "/api/v1/menu/availability/toggle/",
        {"branch": "{branch_id}", "item": "{item_id}", "is_available": True},
        "avail",
    ),
    (
        "availability_bulk_toggle",
        "POST",
        "/api/v1/menu/availability/bulk-toggle/",
        {"branch": "{branch_id}", "item_ids": ["{item_id}"], "is_available": True},
        "avail",
    ),
    ("menu_full_active", "GET", "/api/v1/menu/full/?branch={branch_id}", None, "view"),
]

ROLES = [
    Role.OWNER,
    Role.BRANCH_MANAGER,
    Role.CASHIER,
    Role.WAITER,
    Role.KITCHEN,
    Role.INVENTORY_MANAGER,
]

TEST_CASES = [(role, endpoint) for role in ROLES for endpoint in ENDPOINTS]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role,endpoint_def", TEST_CASES, ids=[f"{r}-{e[0]}" for r, e in TEST_CASES]
)
def test_menu_rbac_endpoint_matrix(rbac_matrix_env, role, endpoint_def):
    """Exhaustive parametrised matrix test: 6 roles x 25 menu endpoints (150 total cases).

    Verifies that permissions strictly follow the RBAC specification:
    - OWNER, BRANCH_MANAGER, INVENTORY_MANAGER: full access
    - CASHIER, KITCHEN: read menu and toggle availability; cannot manage categories/items
    - WAITER: read menu only (403 on ALL availability and management endpoints)
    """
    action_name, method, url_tmpl, payload, required_category = endpoint_def
    env = rbac_matrix_env
    user = env["users"][role]
    client = make_role_client(user, env["tenant"])

    url = url_tmpl.format(
        cat_id=env["category"].id,
        item_id=env["item"].id,
        og_id=env["option_group"].id,
        branch_id=env["branch"].id,
    )

    # Determine expected permission result for this role
    has_manage = role in {Role.OWNER, Role.BRANCH_MANAGER, Role.INVENTORY_MANAGER}
    has_avail = role in {
        Role.OWNER,
        Role.BRANCH_MANAGER,
        Role.CASHIER,
        Role.KITCHEN,
        Role.INVENTORY_MANAGER,
    }
    has_view = True  # all authenticated tenant roles have menu.view

    if required_category == "manage":
        allowed = has_manage
    elif required_category == "avail":
        allowed = has_avail
    else:  # "view"
        allowed = has_view

    # Prepare payload with replacements
    formatted_payload: dict[str, Any] | None = None
    if payload is not None:
        formatted_payload = {}
        for k, v in payload.items():
            if isinstance(v, str):
                formatted_payload[k] = v.format(
                    cat_id=env["category"].id,
                    item_id=env["item"].id,
                    branch_id=env["branch"].id,
                )
            elif isinstance(v, list) and v and isinstance(v[0], str):
                formatted_payload[k] = [x.format(item_id=env["item"].id) for x in v]
            else:
                formatted_payload[k] = v

    # Execute request
    if method == "GET":
        res = client.get(url)
    elif method == "POST":
        res = client.post(url, formatted_payload, format="json")
    elif method == "PATCH":
        res = client.patch(url, formatted_payload, format="json")
    elif method == "PUT":
        res = client.put(url, formatted_payload, format="json")
    elif method == "DELETE":
        res = client.delete(url)
    else:
        raise ValueError(f"Unsupported method {method}")

    if allowed:
        # Should not be 403 Forbidden
        assert res.status_code != 403, (
            f"Role {role} was unexpectedly forbidden (403) from {method} {url}"
        )
    else:
        # Strictly 403 Forbidden
        assert res.status_code == 403, (
            f"Role {role} should be forbidden (403) from {method} {url}, but got {res.status_code}"
        )
