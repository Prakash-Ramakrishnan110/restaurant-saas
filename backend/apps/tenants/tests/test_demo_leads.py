import logging

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import Membership, User
from apps.audit.models import AuditLog
from apps.rbac.constants import Role
from apps.tenants.models import DemoLead, Tenant


@pytest.fixture(autouse=True)
def clear_lead_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_public_lead_submission_valid_and_no_pii_in_logs(caplog):
    client = APIClient()
    with caplog.at_level(logging.INFO, logger="apps.tenants.leads"):
        resp = client.post(
            "/api/v1/public/leads/",
            {
                "name": "Karthik Subramanian",
                "phone": "+91 98765 43210",
                "business_type": "TEA_SHOP",
                "city": "Madurai",
                "message": "Need counter token setup",
                "language": "ta",
                "consent": True,
                "website": "",
            },
            format="json",
            HTTP_ORIGIN="http://localhost:4173",
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "received"
    assert "9876543210" not in str(data)
    assert "id" not in data

    lead = DemoLead.objects.get()
    assert lead.phone == "9876543210"
    assert lead.business_type == "TEA_SHOP"
    assert lead.status == "NEW"
    assert "9876543210" not in caplog.text
    assert "Karthik" not in caplog.text


@pytest.mark.django_db
def test_public_lead_rejects_invalid_phone_consent_honeypot_and_origin():
    client = APIClient()

    # Invalid phone
    r_phone = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Ravi",
            "phone": "12345",
            "business_type": "CAFE",
            "city": "Chennai",
            "consent": True,
        },
        format="json",
    )
    assert r_phone.status_code == 400

    # Missing consent
    r_consent = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Ravi",
            "phone": "9876543211",
            "business_type": "CAFE",
            "city": "Chennai",
            "consent": False,
        },
        format="json",
    )
    assert r_consent.status_code == 400

    # Honeypot triggered
    r_honeypot = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Bot",
            "phone": "9876543212",
            "business_type": "CAFE",
            "city": "Chennai",
            "consent": True,
            "website": "https://spam.example.com",
        },
        format="json",
    )
    assert r_honeypot.status_code == 400

    # Disallowed Origin
    r_origin = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Ravi",
            "phone": "9876543213",
            "business_type": "CAFE",
            "city": "Chennai",
            "consent": True,
        },
        format="json",
        HTTP_ORIGIN="https://evil.example.com",
    )
    assert r_origin.status_code == 403
    assert DemoLead.objects.count() == 0


@pytest.mark.django_db
def test_public_lead_rate_limit_by_ip_and_phone():
    client = APIClient()
    # Phone limit is 3 per hour (different IPs)
    for i in range(3):
        resp = client.post(
            "/api/v1/public/leads/",
            {
                "name": f"Owner {i}",
                "phone": "9876501234",
                "business_type": "RESTAURANT",
                "city": "Coimbatore",
                "consent": True,
            },
            format="json",
            REMOTE_ADDR=f"10.0.0.{i + 1}",
        )
        assert resp.status_code == 201

    resp_4th = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Owner 4",
            "phone": "9876501234",
            "business_type": "RESTAURANT",
            "city": "Coimbatore",
            "consent": True,
        },
        format="json",
        REMOTE_ADDR="10.0.0.9",
    )
    assert resp_4th.status_code == 429

    # IP limit is 5 per 10 min
    for i in range(5):
        resp = client.post(
            "/api/v1/public/leads/",
            {
                "name": f"Guest {i}",
                "phone": f"987651111{i}",
                "business_type": "CAFE",
                "city": "Trichy",
                "consent": True,
            },
            format="json",
            REMOTE_ADDR="10.0.1.50",
        )
        assert resp.status_code == 201

    resp_6th = client.post(
        "/api/v1/public/leads/",
        {
            "name": "Guest 6",
            "phone": "9876511119",
            "business_type": "CAFE",
            "city": "Trichy",
            "consent": True,
        },
        format="json",
        REMOTE_ADDR="10.0.1.50",
    )
    assert resp_6th.status_code == 429


@pytest.mark.django_db
def test_platform_leads_rbac_and_audit_log():
    lead = DemoLead.objects.create(
        name="Anand",
        phone="9876543219",
        business_type="HOTEL",
        city="Salem",
        consent=True,
    )
    tenant = Tenant.objects.create(name="Kaveri", slug="kaveri-lead-test")
    owner = User.objects.create_user(email="owner_lead@test.com", password="Password123!")
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER)

    waiter = User.objects.create_user(email="waiter_lead@test.com", password="Password123!")
    Membership.objects.create(user=waiter, tenant=tenant, role=Role.WAITER)

    admin = User.objects.create_user(
        email="admin_lead@test.com",
        password="AdminPassword123!",
        is_platform_admin=True,
    )

    # Unauthenticated -> 401
    anon_client = APIClient()
    assert anon_client.get("/api/v1/platform/leads/").status_code == 401

    # Restaurant roles -> 403
    for u in (owner, waiter):
        c = APIClient()
        c.force_authenticate(user=u)
        assert c.get("/api/v1/platform/leads/").status_code == 403
        assert (
            c.patch(
                f"/api/v1/platform/leads/{lead.id}/",
                {"status": "CONTACTED"},
                format="json",
            ).status_code
            == 403
        )

    # Platform Admin -> 200 list + 200 patch + AuditLog
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    list_resp = admin_client.get("/api/v1/platform/leads/")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["results"]) == 1

    patch_resp = admin_client.patch(
        f"/api/v1/platform/leads/{lead.id}/",
        {"status": "CONTACTED", "notes": "Called at 11 AM"},
        format="json",
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "CONTACTED"

    audit = AuditLog.objects.get(action="platform.lead.status_updated", entity_id=str(lead.id))
    assert audit.before_state == {"status": "NEW"}
    assert audit.after_state == {"status": "CONTACTED"}
