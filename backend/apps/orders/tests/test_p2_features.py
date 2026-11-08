import pytest
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.core.context import set_current_tenant
from apps.tenants.models import Tenant


@pytest.mark.django_db
def test_p2_customer_crm_and_reports():
    call_command("seed_demo")

    kaveri_tenant = Tenant.objects.get(slug="kaveri-cafe")
    set_current_tenant(kaveri_tenant)

    owner = User.objects.get(email="owner@kavericafe.com")
    token = str(RefreshToken.for_user(owner).access_token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    client.defaults["HTTP_X_TENANT_ID"] = str(kaveri_tenant.id)

    # 1. Create a customer (H-24)
    create_res = client.post(
        "/api/v1/customers/",
        {
            "name": "Ravi Kumar",
            "phone": "+919876543210",
            "email": "ravi@example.com",
            "consent_given": True,
            "dietary_preference": "VEG",
            "allergies": "Peanuts",
            "notes": "Prefers corner table, filter coffee with less sugar",
        },
        format="json",
    )
    assert create_res.status_code == status.HTTP_201_CREATED, create_res.data
    assert create_res.data["id"]

    # 2. Query customer by phone
    query_res = client.get("/api/v1/customers/", {"phone": "+919876543210"})
    assert query_res.status_code == status.HTTP_200_OK
    assert len(query_res.data["results"]) == 1
    assert query_res.data["results"][0]["name"] == "Ravi Kumar"

    # 3. P2 Reports Suite
    # Exceptions Report (H-01)
    exc_res = client.get("/api/v1/reports/exceptions/")
    assert exc_res.status_code == status.HTTP_200_OK
    assert "discounted_invoices_count" in exc_res.data
    assert "cancelled_orders_count" in exc_res.data
    assert "reprints_count" in exc_res.data

    # Staff Report (H-22)
    staff_res = client.get("/api/v1/reports/staff/")
    assert staff_res.status_code == status.HTTP_200_OK
    assert "staff" in staff_res.data

    # Outlets Comparison Report (H-21)
    outlets_res = client.get("/api/v1/reports/outlets/")
    assert outlets_res.status_code == status.HTTP_200_OK
    assert "outlets" in outlets_res.data
    assert len(outlets_res.data["outlets"]) >= 1

    # Order Prep Delay Report (H-06)
    delay_res = client.get("/api/v1/reports/orders-delay/")
    assert delay_res.status_code == status.HTTP_200_OK
    assert "average_prep_minutes" in delay_res.data
    assert "delayed_orders" in delay_res.data

    # 4. Support Tickets (A-04, R-11)
    ticket_res = client.post(
        "/api/v1/support-tickets/",
        {
            "subject": "Printer paper jam in Kitchen 1",
            "description": "ESC/POS printer stopped printing KOT tickets at 1:30 PM",
            "priority": "HIGH",
            "contact_phone": "+919876543210",
        },
        format="json",
    )
    assert ticket_res.status_code == status.HTTP_201_CREATED, ticket_res.data

    tickets_list = client.get("/api/v1/support-tickets/")
    assert tickets_list.status_code == status.HTTP_200_OK
    assert len(tickets_list.data["results"]) >= 1

    # 5. Announcements (A-05)
    platform_admin = User.objects.filter(is_platform_admin=True).first()
    if not platform_admin:
        platform_admin = User.objects.create_user(
            email="platform.admin@servemyfood.internal",
            password="adminpassword123",
            full_name="Platform Administrator",
            is_platform_admin=True,
        )
    admin_token = str(RefreshToken.for_user(platform_admin).access_token)
    admin_client = APIClient()
    admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    ann_res = admin_client.post(
        "/api/v1/announcements/",
        {
            "title": "Scheduled Maintenance Notice",
            "message": "Routine cloud database maintenance on Sunday at 2:00 AM IST",
            "announcement_type": "MAINTENANCE",
            "is_active": True,
        },
        format="json",
    )
    assert ann_res.status_code == status.HTTP_201_CREATED, ann_res.data

    # Tenant can read the active announcement
    tenant_ann_res = client.get("/api/v1/announcements/")
    assert tenant_ann_res.status_code == status.HTTP_200_OK
    assert any(a["title"] == "Scheduled Maintenance Notice" for a in tenant_ann_res.data["results"])
