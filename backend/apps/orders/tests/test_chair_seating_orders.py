import pytest
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.core.context import set_current_tenant
from apps.menu.models import MenuItem
from apps.orders.models import OrderItem
from apps.tenants.models import Tenant
from apps.venues.models import DiningTable, TableSession


@pytest.mark.django_db
def test_chair_seating_and_seat_level_order():
    call_command("seed_demo")

    kaveri_tenant = Tenant.objects.get(slug="kaveri-cafe")
    set_current_tenant(kaveri_tenant)

    owner = User.objects.get(email="owner@kavericafe.com")
    token = str(RefreshToken.for_user(owner).access_token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    client.defaults["HTTP_X_TENANT_ID"] = str(kaveri_tenant.id)

    # 1. Inspect dining table seating layout (4-seater, 6-seater)
    table_4seater = DiningTable.objects.filter(tenant=kaveri_tenant, capacity=4).first()
    assert table_4seater is not None
    assert table_4seater.capacity == 4

    # 2. Get or open an active table session
    session = TableSession.objects.filter(
        tenant=kaveri_tenant, table=table_4seater, status="OPEN"
    ).first()
    if not session:
        session = TableSession.objects.create(
            tenant=kaveri_tenant,
            branch=table_4seater.branch,
            table=table_4seater,
            status="OPEN",
            guest_count=4,
        )

    # 3. Retrieve menu items
    menu_items = list(MenuItem.objects.filter(tenant=kaveri_tenant, is_active=True)[:3])
    assert len(menu_items) >= 2

    # 4. Dispatch order with individual seat/chair attribution
    order_payload = {
        "branch_id": str(table_4seater.branch.id),
        "table_session_id": str(session.id),
        "order_workflow": "TABLE_SERVICE",
        "notes": "4-Seater Table Order with Chair Assignment",
        "items": [
            {
                "menu_item_id": str(menu_items[0].id),
                "quantity": 2,
                "course": "STARTER",
                "seat_number": 1,  # Chair 1
                "notes": "Extra crispy",
            },
            {
                "menu_item_id": str(menu_items[1].id),
                "quantity": 1,
                "course": "MAIN",
                "seat_number": 2,  # Chair 2
                "notes": "Medium spicy",
            },
            {
                "menu_item_id": str(menu_items[0].id),
                "quantity": 1,
                "course": "MAIN",
                "seat_number": 4,  # Chair 4
                "notes": "",
            },
        ],
    }

    create_res = client.post("/api/v1/orders/", order_payload, format="json")
    assert create_res.status_code == status.HTTP_201_CREATED, create_res.data
    order_data = create_res.data
    order_id = order_data["id"]

    # 5. Verify seat_number is stored and returned in serialized items
    items_out = order_data["items"]
    assert len(items_out) == 3

    seats_returned = [it["seat_number"] for it in items_out]
    assert 1 in seats_returned
    assert 2 in seats_returned
    assert 4 in seats_returned

    # 6. Verify database records
    db_items = OrderItem.objects.filter(order_id=order_id).order_by("created_at")
    assert db_items.count() == 3
    chair_numbers = [it.seat_number for it in db_items]
    assert chair_numbers == [1, 2, 4]
