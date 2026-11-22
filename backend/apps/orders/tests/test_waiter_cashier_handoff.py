from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import OrderStatus
from apps.orders.services import create_order
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.models import (
    DiningTable,
    Section,
    ServiceArea,
    StaffSectionAssignment,
    TableSession,
)


@pytest.mark.django_db
def test_cashier_only_billing_waiter_handoff_last_bill_and_shift_plan(db: Any) -> None:
    tenant = Tenant.objects.create(name="Handoff Mess", slug="handoff-mess")
    plan = Plan.objects.create(
        name="Pro Handoff",
        slug="pro-handoff",
        price_paise=199900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    branch = Branch.objects.create(tenant=tenant, name="Main")
    area = ServiceArea.objects.create(tenant=tenant, branch=branch, name="Hall")
    section = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name="Row 1")
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T1", capacity=4
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Breakfast")
    item = MenuItem.objects.create(tenant=tenant, category=cat, name="Idly", base_price_paise=4000)

    waiter_user = User.objects.create_user(
        email="w@test.com", password="Password123!", full_name="Waiter 1"
    )
    waiter_m = Membership.objects.create(
        user=waiter_user, tenant=tenant, role=Role.WAITER, is_active=True
    )
    waiter_m.branches.add(branch)

    cashier_user = User.objects.create_user(
        email="c@test.com", password="Password123!", full_name="Cashier 1"
    )
    cashier_m = Membership.objects.create(
        user=cashier_user, tenant=tenant, role=Role.CASHIER, is_active=True
    )
    cashier_m.branches.add(branch)

    # Shift plan + section assignment
    assign = StaffSectionAssignment.objects.create(
        tenant=tenant,
        branch=branch,
        membership=waiter_m,
        section=section,
        shift_name="MORNING",
        shift_start="07:00",
        shift_end="15:00",
    )
    assert assign.shift_name == "MORNING"

    session = TableSession.objects.create(tenant=tenant, branch=branch, table=table, guest_count=2)
    order = create_order(
        branch=branch,
        items_data=[{"menu_item_id": str(item.id), "quantity": 1}],
        user_membership=waiter_m,
        table_session=session,
    )
    order.status = OrderStatus.SERVED
    order.save(update_fields=["status"])

    waiter_client = APIClient()
    waiter_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(waiter_user).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    cashier_client = APIClient()
    cashier_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(cashier_user).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    # 1. Waiter is blocked (403) from Cashier Billing, Invoices directory, and Shift Closeout
    assert waiter_client.get(f"/api/v1/orders/billing/session/{session.id}/").status_code == 403
    assert (
        waiter_client.post(
            f"/api/v1/orders/billing/session/{session.id}/settle/",
            {"payment_method": "CASH", "amount_tendered_paise": 4000},
            format="json",
        ).status_code
        == 403
    )
    assert waiter_client.get("/api/v1/invoices/").status_code == 403
    assert waiter_client.get("/api/v1/orders/shifts/current/").status_code == 403

    # 2. Waiter cannot close a session that has active orders
    assert waiter_client.post(f"/api/v1/sessions/{session.id}/close/").status_code == 400

    # 3. Waiter requests payment from Cashier
    req_res = waiter_client.post(
        "/api/v1/orders/service-requests/",
        {"table_id": str(table.id), "request_type": "REQUEST_BILL"},
        format="json",
    )
    assert req_res.status_code == 201

    # 4. Cashier settles the bill
    settle_res = cashier_client.post(
        f"/api/v1/orders/billing/session/{session.id}/settle/",
        {"payment_method": "CASH", "amount_tendered_paise": 4000, "discount_paise": 0},
        format="json",
    )
    assert settle_res.status_code == 201

    # 5. Waiter can check read-only Last Bill for that table to tell/verify with customer
    last_bill_res = waiter_client.get(f"/api/v1/invoices/last-for-table/?table_id={table.id}")
    assert last_bill_res.status_code == 200
    assert last_bill_res.data["found"] is True
    assert last_bill_res.data["total_paise"] == 4000
