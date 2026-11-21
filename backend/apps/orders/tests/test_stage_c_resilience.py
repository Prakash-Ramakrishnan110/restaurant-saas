import asyncio
import hashlib
import io
import json
import zipfile
from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.consumers import BranchStreamConsumer, _authenticate_branch_stream_sync
from apps.orders.models import Order
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import AreaType, SectionType
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession


@pytest.fixture
def stage_c_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(
        name="Stage C Bistro",
        slug="stage-c-bistro",
        status=Tenant.Status.ACTIVE,
    )
    plan = Plan.objects.create(
        name="Pro Plan C",
        slug="pro-stage-c",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    branch = Branch.objects.create(tenant=tenant, name="Main Outlet")

    owner_user = User.objects.create_user(
        email="owner@stagec.test", password="Password123!", full_name="Stage C Owner"
    )
    owner_membership = Membership.objects.create(
        tenant=tenant, user=owner_user, role=Role.OWNER, is_active=True
    )
    owner_membership.branches.add(branch)

    waiter_user = User.objects.create_user(
        email="waiter@stagec.test", password="Password123!", full_name="Stage C Waiter"
    )
    waiter_membership = Membership.objects.create(
        tenant=tenant, user=waiter_user, role=Role.WAITER, is_active=True
    )
    waiter_membership.branches.add(branch)

    other_tenant = Tenant.objects.create(
        name="Rival Diner",
        slug="rival-diner",
        status=Tenant.Status.ACTIVE,
    )
    Subscription.objects.create(tenant=other_tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(other_tenant)
    other_branch = Branch.objects.create(tenant=other_tenant, name="Rival Main")
    other_user = User.objects.create_user(
        email="rival@stagec.test", password="Password123!", full_name="Rival Owner"
    )
    other_membership = Membership.objects.create(
        tenant=other_tenant, user=other_user, role=Role.OWNER, is_active=True
    )
    other_membership.branches.add(other_branch)

    set_current_tenant(tenant)
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Main Hall", area_type=AreaType.DINING
    )
    section = Section.objects.create(
        tenant=tenant,
        branch=branch,
        service_area=area,
        name="Ground",
        section_type=SectionType.INDOOR,
    )
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T-01", capacity=4
    )
    session = TableSession.objects.create(
        tenant=tenant,
        branch=branch,
        table=table,
        guest_count=2,
        opened_by=owner_membership,
        status="OPEN",
    )

    category = MenuCategory.objects.create(tenant=tenant, name="Mains")
    item = MenuItem.objects.create(
        tenant=tenant,
        category=category,
        name="Masala Dosa",
        base_price_paise=14000,
        food_type=FoodType.VEG,
        is_active=True,
    )

    owner_client = APIClient()
    owner_tok = str(RefreshToken.for_user(owner_user).access_token)
    owner_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {owner_tok}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    waiter_client = APIClient()
    waiter_tok = str(RefreshToken.for_user(waiter_user).access_token)
    waiter_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {waiter_tok}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    return {
        "tenant": tenant,
        "branch": branch,
        "owner_user": owner_user,
        "owner_client": owner_client,
        "waiter_user": waiter_user,
        "waiter_client": waiter_client,
        "other_tenant": other_tenant,
        "other_branch": other_branch,
        "other_user": other_user,
        "session": session,
        "item": item,
    }


@pytest.mark.django_db
def test_order_idempotency_key_returns_single_order(stage_c_env: dict[str, Any]) -> None:
    client: APIClient = stage_c_env["owner_client"]
    owner_tok = str(RefreshToken.for_user(stage_c_env["owner_user"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {owner_tok}",
        HTTP_X_TENANT_ID=str(stage_c_env["tenant"].id),
        HTTP_IDEMPOTENCY_KEY="offline-client-uuid-0001",
    )

    payload = {
        "branch_id": str(stage_c_env["branch"].id),
        "table_session_id": str(stage_c_env["session"].id),
        "order_workflow": "TABLE_SERVICE",
        "notes": "Offline replay test",
        "items": [
            {
                "menu_item_id": str(stage_c_env["item"].id),
                "quantity": 2,
                "course": "MAIN",
            }
        ],
    }

    res1 = client.post("/api/v1/orders/", payload, format="json")
    assert res1.status_code == 201
    order_id_1 = res1.data["id"]

    # Replay 2nd and 3rd time with identical Idempotency-Key
    res2 = client.post("/api/v1/orders/", payload, format="json")
    res3 = client.post("/api/v1/orders/", payload, format="json")

    assert res2.status_code == 200
    assert res3.status_code == 200
    assert res2.data["id"] == order_id_1
    assert res3.data["id"] == order_id_1
    assert Order.objects.filter(branch=stage_c_env["branch"]).count() == 1


@pytest.mark.django_db
def test_branch_stream_websocket_auth_and_isolation(stage_c_env: dict[str, Any]) -> None:
    owner_token = str(RefreshToken.for_user(stage_c_env["owner_user"]).access_token)
    other_token = str(RefreshToken.for_user(stage_c_env["other_user"]).access_token)
    branch_id_str = str(stage_c_env["branch"].id)

    # 1. Valid tenant owner token
    code_ok, group_name = _authenticate_branch_stream_sync(owner_token, branch_id_str)
    assert code_ok == 200
    assert group_name == f"branch_{stage_c_env['tenant'].id}_{stage_c_env['branch'].id}"

    # 2. Missing / invalid token -> 4401
    code_missing, _ = _authenticate_branch_stream_sync("", branch_id_str)
    assert code_missing == 4401
    code_bad, _ = _authenticate_branch_stream_sync("not-a-valid-jwt", branch_id_str)
    assert code_bad == 4401

    # 3. Cross-tenant user attempting to subscribe to stage_c_env branch -> 4403
    code_cross, _ = _authenticate_branch_stream_sync(other_token, branch_id_str)
    assert code_cross == 4403

    # 4. Verify consumer ping/pong and event forwarding
    consumer = BranchStreamConsumer()
    sent_frames: list[dict[str, Any]] = []

    async def fake_send_json(content: Any, close: bool = False) -> None:
        sent_frames.append(content)

    consumer.send_json = fake_send_json
    asyncio.run(consumer.receive_json({"type": "ping"}))
    assert sent_frames[0]["type"] == "pong"

    asyncio.run(
        consumer.branch_event(
            {
                "type": "branch.event",
                "event_type": "order.created",
                "payload": {"order_number": "ORD-0001"},
            }
        )
    )
    assert sent_frames[-1]["type"] == "order.created"
    assert sent_frames[-1]["payload"]["order_number"] == "ORD-0001"


@pytest.mark.django_db
def test_export_my_data_zip_archive_and_rbac(stage_c_env: dict[str, Any]) -> None:
    waiter_client: APIClient = stage_c_env["waiter_client"]
    owner_client: APIClient = stage_c_env["owner_client"]

    # 1. Waiter is forbidden (403)
    res_forbidden = waiter_client.get("/api/v1/settings/export-my-data/")
    assert res_forbidden.status_code == 403

    # 2. Owner downloads valid ZIP archive
    res_ok = owner_client.get("/api/v1/settings/export-my-data/")
    assert res_ok.status_code == 200
    assert res_ok["Content-Type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(res_ok.content), "r") as zf:
        names = set(zf.namelist())
        expected_files = {
            "branches.csv",
            "menu_items.csv",
            "orders.csv",
            "invoices.csv",
            "refunds.csv",
            "inventory_items.csv",
            "stock_movements.csv",
            "customers.csv",
            "manifest.json",
        }
        assert expected_files.issubset(names)

        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["tenant_id"] == str(stage_c_env["tenant"].id)
        assert manifest["tenant_slug"] == "stage-c-bistro"

        for csv_name, meta in manifest["files"].items():
            raw_bytes = zf.read(csv_name)
            assert hashlib.sha256(raw_bytes).hexdigest() == meta["sha256"]
            text = raw_bytes.decode("utf-8")
            assert "Rival Main" not in text
            assert "pbkdf2_" not in text
