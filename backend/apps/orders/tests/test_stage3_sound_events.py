import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import OrderSource, OrderStatus, OrderWorkflow
from apps.orders.services import create_order, settle_bill, transition_order_status
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import AreaType, SessionStatus
from apps.venues.models import BranchCapabilities, DiningTable, Section, ServiceArea, TableSession

User = get_user_model()


def _auth_client(user: Any, tenant: Tenant | None = None) -> APIClient:
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    hdrs: dict[str, str] = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    if tenant is not None:
        hdrs["HTTP_X_TENANT_ID"] = str(tenant.id)
    c.credentials(**hdrs)
    return c


@pytest.fixture
def stage3_env(db: Any) -> dict[str, Any]:
    plan = Plan.objects.create(
        name="Stage 3 Plan",
        slug="stage3-plan",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    tenant = Tenant.objects.create(
        name="Kaveri Sound", slug="kaveri-sound", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    BusinessSettings.objects.create(tenant=tenant, legal_name="Kaveri Sound")
    branch_a = Branch.unscoped.create(tenant=tenant, name="Branch A", is_active=True)
    branch_b = Branch.unscoped.create(tenant=tenant, name="Branch B", is_active=True)
    BranchCapabilities.objects.create(tenant=tenant, branch=branch_a)

    area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch_a, name="Hall", area_type=AreaType.DINING
    )
    sec = Section.unscoped.create(tenant=tenant, branch=branch_a, service_area=area, name="Main")
    tbl = DiningTable.unscoped.create(
        tenant=tenant, branch=branch_a, section=sec, label="T4", capacity=4
    )
    session = TableSession.unscoped.create(
        tenant=tenant, branch=branch_a, table=tbl, status=SessionStatus.OPEN
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Tiffin")
    dosa = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Dosa",
        name_ta="தோசை",
        base_price_paise=12345,
        food_type=FoodType.VEG,
    )
    idli = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Idly",
        name_ta="இட்லி",
        base_price_paise=6000,
        food_type=FoodType.VEG,
    )

    other_tenant = Tenant.objects.create(
        name="Other Restaurant", slug="other-s3", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=other_tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    other_branch = Branch.unscoped.create(tenant=other_tenant, name="Other Br", is_active=True)

    role_users = {}
    for idx, (role, _) in enumerate(Role.CHOICES):
        u = User.objects.create_user(
            email=f"s3_{idx}_{role.lower()}@kaveri.test",
            password="Password123!",
            full_name=f"Staff {role}",
        )
        Membership.objects.create(user=u, tenant=tenant, role=role, is_active=True)
        role_users[role] = u

    padmin = User.objects.create_user(
        email="padmin_s3@fusion.in", password="Password123!", is_platform_admin=True
    )

    return {
        "tenant": tenant,
        "branch_a": branch_a,
        "branch_b": branch_b,
        "tbl": tbl,
        "session": session,
        "dosa": dosa,
        "idli": idli,
        "other_tenant": other_tenant,
        "other_branch": other_branch,
        "role_users": role_users,
        "platform_admin": padmin,
    }


@pytest.mark.django_db
def test_event_feed_role_filtering_sentinel_pii_and_isolation(stage3_env: dict[str, Any]) -> None:
    f = stage3_env

    # Create order containing sentinel customer name, kitchen notes, phone number, and price
    order = create_order(
        branch=f["branch_a"],
        items_data=[
            {
                "menu_item_id": str(f["dosa"].id),
                "quantity": 2,
                "notes": "SENTINEL_ITEM_NOTE_SPICY",
            },
            {"menu_item_id": str(f["idli"].id), "quantity": 1},
        ],
        table_session=f["session"],
        order_workflow=OrderWorkflow.TABLE_SERVICE,
        source=OrderSource.QR,
        initial_status=OrderStatus.PLACED,
        guest_label="SENTINEL_CUSTOMER",
        notes="SENTINEL_ORDER_NOTE_PHONE_9876543210",
    )
    transition_order_status(order, OrderStatus.PREPARING)
    transition_order_status(order, OrderStatus.READY)
    settle_bill(f["session"], payment_method="CASH")

    # Also test >20 min late ticket auto-emission
    late_ord = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["idli"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.PLACED,
    )
    late_ord.placed_at = timezone.now() - timedelta(minutes=25)
    late_ord.save(update_fields=["placed_at"])

    feed_url = f"/api/v1/events/?since=0&branch_id={f['branch_a'].id}"

    # Unauthenticated -> 401; Platform admin & Inventory Manager -> 403
    assert APIClient().get(feed_url).status_code == status.HTTP_401_UNAUTHORIZED
    assert _auth_client(f["platform_admin"]).get(feed_url).status_code == status.HTTP_403_FORBIDDEN
    assert (
        _auth_client(f["role_users"][Role.INVENTORY_MANAGER], f["tenant"]).get(feed_url).status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Kitchen sees new_order and ticket_late, NOT payment_received
    k_res = _auth_client(f["role_users"][Role.KITCHEN], f["tenant"]).get(feed_url)
    assert k_res.status_code == status.HTTP_200_OK
    k_types = {e["event_type"] for e in k_res.data["events"]}
    assert "new_order" in k_types
    assert "ticket_late" in k_types
    assert "payment_received" not in k_types

    # Sentinel PII/notes/phone/price MUST NEVER appear anywhere in response payload
    raw_json = str(k_res.data)
    assert "SENTINEL_CUSTOMER" not in raw_json
    assert "SENTINEL_ITEM_NOTE_SPICY" not in raw_json
    assert "SENTINEL_ORDER_NOTE_PHONE_9876543210" not in raw_json
    assert "9876543210" not in raw_json
    assert "12345" not in raw_json

    # Dish name & Tamil name + quantity ARE present safely
    new_ev = next(e for e in k_res.data["events"] if e["event_type"] == "new_order")
    assert new_ev["target_label"] == "T4"
    assert new_ev["dishes"][0]["name"] == "Dosa"
    assert new_ev["dishes"][0]["name_ta"] == "தோசை"
    assert new_ev["dishes"][0]["qty"] == 2

    # Waiter sees table_ready, NOT payment_received
    w_res = _auth_client(f["role_users"][Role.WAITER], f["tenant"]).get(feed_url)
    assert w_res.status_code == status.HTTP_200_OK
    w_types = {e["event_type"] for e in w_res.data["events"]}
    assert "table_ready" in w_types
    assert "payment_received" not in w_types

    # Cashier sees payment_received
    c_res = _auth_client(f["role_users"][Role.CASHIER], f["tenant"]).get(feed_url)
    assert c_res.status_code == status.HTTP_200_OK
    c_types = {e["event_type"] for e in c_res.data["events"]}
    assert "payment_received" in c_types

    # Incremental polling ?since=<latest_seq> returns zero old events
    since_res = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).get(
        f"/api/v1/events/?since={k_res.data['latest_seq']}&branch_id={f['branch_a'].id}"
    )
    assert since_res.status_code == status.HTTP_200_OK
    assert since_res.data["events"] == []

    # Cross-tenant branch ID -> 404; random UUID -> 404; restricted branch_a cashier asking branch_b -> 404
    assert (
        _auth_client(f["role_users"][Role.OWNER], f["tenant"])
        .get(f"/api/v1/events/?branch_id={f['other_branch'].id}")
        .status_code
        == 404
    )
    assert (
        _auth_client(f["role_users"][Role.OWNER], f["tenant"])
        .get(f"/api/v1/events/?branch_id={uuid.uuid4()}")
        .status_code
        == 404
    )
    cmem = Membership.objects.get(user=f["role_users"][Role.CASHIER], tenant=f["tenant"])
    cmem.branches.add(f["branch_a"])
    assert (
        _auth_client(f["role_users"][Role.CASHIER], f["tenant"])
        .get(f"/api/v1/events/?branch_id={f['branch_b'].id}")
        .status_code
        == 404
    )

    # O(1) query count on event polling (when no new late tickets needed)
    with CaptureQueriesContext(connection) as ctx:
        q_res = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).get(feed_url)
        assert q_res.status_code == 200
    assert len(ctx) <= 7


@pytest.mark.django_db
def test_branch_sound_defaults_rbac_audit_and_isolation(stage3_env: dict[str, Any]) -> None:
    f = stage3_env
    url = "/api/v1/events/sound-defaults/"

    # GET: food-service roles 200; INVENTORY_MANAGER & PLATFORM_ADMIN 403
    for role in (Role.OWNER, Role.BRANCH_MANAGER, Role.CASHIER, Role.WAITER, Role.KITCHEN):
        assert _auth_client(f["role_users"][role], f["tenant"]).get(url).status_code == 200
    assert (
        _auth_client(f["role_users"][Role.INVENTORY_MANAGER], f["tenant"]).get(url).status_code
        == 403
    )
    assert _auth_client(f["platform_admin"]).get(url).status_code == 403

    # PATCH: WAITER/CASHIER/KITCHEN/INVENTORY_MANAGER/PLATFORM_ADMIN -> 403
    payload = {
        "branch_id": str(f["branch_a"].id),
        "voice_language": "TA",
        "dish_announcement_level": "FULL",
        "speech_rate": 1.1,
        "events": {"new_order": {"chime": True, "voice": True, "nag": True}},
    }
    for denied in (Role.WAITER, Role.CASHIER, Role.KITCHEN, Role.INVENTORY_MANAGER):
        assert (
            _auth_client(f["role_users"][denied], f["tenant"])
            .patch(url, payload, format="json")
            .status_code
            == 403
        )
    assert _auth_client(f["platform_admin"]).patch(url, payload, format="json").status_code == 403

    # OWNER & BRANCH_MANAGER -> 200 + AuditLog written
    for mgr_role in (Role.OWNER, Role.BRANCH_MANAGER):
        r = _auth_client(f["role_users"][mgr_role], f["tenant"]).patch(url, payload, format="json")
        assert r.status_code == 200
        assert r.data["voice_language"] == "TA"
        assert r.data["dish_announcement_level"] == "FULL"

    assert (
        AuditLog.objects.filter(tenant=f["tenant"], action="branch.sound_defaults.updated").count()
        == 2
    )

    # Foreign branch_id vs random UUID in body -> identical 400 INVALID_REFERENCE
    r_foreign = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).patch(
        url, {**payload, "branch_id": str(f["other_branch"].id)}, format="json"
    )
    r_rand = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).patch(
        url, {**payload, "branch_id": str(uuid.uuid4())}, format="json"
    )
    assert r_foreign.status_code == 400
    assert r_rand.status_code == 400
    assert r_foreign.data["error"]["code"] == "INVALID_REFERENCE"
    assert r_rand.data["error"]["code"] == "INVALID_REFERENCE"
