import pytest
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.core.context import set_current_tenant
from apps.orders.models import Order, OrderStatus
from apps.tenants.models import Tenant
from apps.venues.models import DiningTable, TableSession


@pytest.mark.django_db
def test_demo_journey_d1_full_walkthrough():
    """Authoritative D1 Demo Journey Test on Real Stack:

    1. Seed demo database with The Grand Kaveri Cafe
    2. Waiter logs in, verifies open table session on T1, checks placed order
    3. Kitchen staff logs in, views KDS, bumps order to PREPARING then READY
    4. Waiter logs in, views Ready to Serve, marks order as SERVED
    5. Cashier logs in, calculates bill (0 tax), settles with CASH tender in integer paise
    6. Owner logs in, calls GET /api/v1/reports/today/, asserts sales metrics, payment breakdown, top items
    """
    # Step 1: Seed demo data
    call_command("seed_demo")

    kaveri_tenant = Tenant.objects.get(slug="kaveri-cafe")
    set_current_tenant(kaveri_tenant)

    def get_authenticated_client(email: str) -> APIClient:
        user = User.objects.get(email=email)
        token = str(RefreshToken.for_user(user).access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        client.defaults["HTTP_X_TENANT_ID"] = str(kaveri_tenant.id)
        return client

    # Step 2: Waiter Journey
    waiter_client = get_authenticated_client("waiter@kavericafe.com")

    # Waiter checks Tables
    res_tables = waiter_client.get("/api/v1/tables/")
    assert res_tables.status_code == status.HTTP_200_OK

    t1 = DiningTable.unscoped.get(tenant=kaveri_tenant, label="T1")
    session_t1 = TableSession.unscoped.get(tenant=kaveri_tenant, table=t1, status="OPEN")

    # Order ORD-DEMO-001 was seeded in PLACED status
    order = Order.unscoped.get(tenant=kaveri_tenant, table_session=session_t1)
    assert order.status == OrderStatus.PLACED
    assert order.total_paise == 22500  # 13500 + 2*4500

    # Step 3: Kitchen KDS Journey
    kitchen_client = get_authenticated_client("kitchen@kavericafe.com")
    res_kds = kitchen_client.get("/api/v1/orders/kds/")
    assert res_kds.status_code == status.HTTP_200_OK

    # Kitchen bumps order: PLACED -> PREPARING
    res_bump_1 = kitchen_client.post(f"/api/v1/orders/kds/{order.id}/bump/")
    assert res_bump_1.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == OrderStatus.PREPARING

    # Kitchen bumps order: PREPARING -> READY
    res_bump_2 = kitchen_client.post(f"/api/v1/orders/kds/{order.id}/bump/")
    assert res_bump_2.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == OrderStatus.READY

    # Step 4: Waiter Delivery Journey
    res_serve = waiter_client.post(f"/api/v1/orders/{order.id}/serve/")
    assert res_serve.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == OrderStatus.SERVED

    # Step 5: Cashier Checkout Journey
    cashier_client = get_authenticated_client("cashier@kavericafe.com")

    # Cashier inspects bill calculation
    res_calc = cashier_client.get(f"/api/v1/orders/billing/session/{session_t1.id}/")
    assert res_calc.status_code == status.HTTP_200_OK
    calc_data = res_calc.data
    assert calc_data["subtotal_paise"] == 22500
    assert calc_data["total_paise"] == 22500

    # Cashier tenders ₹300.00 (30,000 paise) for ₹225.00 bill (22,500 paise)
    res_checkout = cashier_client.post(
        f"/api/v1/orders/billing/session/{session_t1.id}/settle/",
        {
            "payment_method": "CASH",
            "amount_tendered_paise": 30000,
            "discount_paise": 0,
        },
        format="json",
    )
    assert (
        res_checkout.status_code == status.HTTP_200_OK
        or res_checkout.status_code == status.HTTP_201_CREATED
    )
    invoice_data = res_checkout.data
    assert invoice_data["subtotal_paise"] == 22500
    assert invoice_data["total_paise"] == 22500
    assert invoice_data["amount_tendered_paise"] == 30000
    assert invoice_data["change_due_paise"] == 7500  # ₹75.00 change
    assert invoice_data["is_settled"] is True

    # Session closed and table released
    session_t1.refresh_from_db()
    assert session_t1.status == "CLOSED"

    # Step 6: Owner Dashboard & Reports Journey
    owner_client = get_authenticated_client("owner@kavericafe.com")
    res_today = owner_client.get("/api/v1/reports/today/")
    assert res_today.status_code == status.HTTP_200_OK
    report = res_today.data

    # Sales metrics strictly in integer paise
    assert report["sales_paise"] > 0
    assert report["orders_count"] >= 1
    assert "CASH" in report["sales_by_payment_method"]
    assert report["sales_by_payment_method"]["CASH"] >= 22500

    # Top items includes ordered item
    top_names = [item["item_name"] for item in report["top_items"]]
    assert any("Ghee Roast Masala Dosa" in name for name in top_names)

    # Last bills includes newly settled invoice
    bill_numbers = [b["invoice_number"] for b in report["last_bills"]]
    assert invoice_data["invoice_number"] in bill_numbers
