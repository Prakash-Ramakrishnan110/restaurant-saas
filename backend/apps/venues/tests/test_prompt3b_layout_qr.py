import cv2
import numpy as np
import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.rbac.constants import Role
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.models import DiningTable, ServiceArea
from apps.venues.services import generate_qr_code


@pytest.fixture
def venue_env(django_db_blocker):
    with django_db_blocker.unblock():
        from django.contrib.auth import get_user_model

        User = get_user_model()
        tenant = Tenant.objects.create(name="Saravana Bhavan", slug="saravana-bhavan")
        branch = Branch.objects.create(tenant=tenant, name="T. Nagar Branch", is_active=True)

        plan = Plan.objects.create(
            name="Pro Growth",
            slug="pro-growth",
            entitlements={"max_service_areas": 10, "max_tables": 50},
        )
        Subscription.objects.create(tenant=tenant, plan=plan, status="ACTIVE")

        owner = User.objects.create_user(
            email="owner@sb.com", password="Password123!", full_name="Owner Sb"
        )
        Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)

        mgr = User.objects.create_user(
            email="mgr@sb.com", password="Password123!", full_name="Manager Sb"
        )
        Membership.objects.create(user=mgr, tenant=tenant, role=Role.BRANCH_MANAGER, is_active=True)

        cashier = User.objects.create_user(
            email="cashier@sb.com", password="Password123!", full_name="Cashier Sb"
        )
        Membership.objects.create(user=cashier, tenant=tenant, role=Role.CASHIER, is_active=True)

        client_owner = APIClient()
        token = str(RefreshToken.for_user(owner).access_token)
        client_owner.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_ID=str(tenant.id))

        client_mgr = APIClient()
        token_mgr = str(RefreshToken.for_user(mgr).access_token)
        client_mgr.credentials(HTTP_AUTHORIZATION=f"Bearer {token_mgr}", HTTP_X_TENANT_ID=str(tenant.id))

        client_cashier = APIClient()
        token_c = str(RefreshToken.for_user(cashier).access_token)
        client_cashier.credentials(HTTP_AUTHORIZATION=f"Bearer {token_c}", HTTP_X_TENANT_ID=str(tenant.id))

        from apps.core.context import set_current_tenant
        set_current_tenant(tenant)

        return {
            "tenant": tenant,
            "branch": branch,
            "owner": owner,
            "client_owner": client_owner,
            "client_mgr": client_mgr,
            "client_cashier": client_cashier,
        }


@pytest.mark.django_db
def test_layout_templates_catalog(venue_env):
    client = venue_env["client_owner"]
    res = client.get("/api/v1/layout-templates/")
    assert res.status_code == status.HTTP_200_OK
    keys = [t["key"] for t in res.data]
    assert "cafe_small" in keys
    assert "restaurant_3_sections" in keys
    assert "fine_dining" in keys
    assert "hotel" in keys
    assert "counters" in keys
    assert "empty" in keys

    # Filter by venue_profile
    res_cafe = client.get("/api/v1/layout-templates/?venue_profile=CAFE")
    assert res_cafe.status_code == status.HTTP_200_OK
    assert all("CAFE" in t["recommended_profiles"] for t in res_cafe.data)


@pytest.mark.django_db
def test_template_cafe_small_dry_run_and_apply(venue_env):
    client = venue_env["client_owner"]
    branch = venue_env["branch"]

    # 1. Dry run
    res_dry = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/cafe_small/apply/",
        {"dry_run": True, "mode": "new"},
        format="json",
    )
    assert res_dry.status_code == status.HTTP_200_OK
    assert res_dry.data["dry_run"] is True
    assert res_dry.data["would_create"]["tables_count"] == 10
    assert res_dry.data["would_create"]["areas_count"] == 1
    assert res_dry.data["plan_allows"] is True
    # Zero tables created in dry run
    assert DiningTable.objects.filter(branch=branch).count() == 0

    # 2. Actual Apply
    res_apply = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/cafe_small/apply/",
        {"dry_run": False, "mode": "new"},
        format="json",
    )
    assert res_apply.status_code == status.HTTP_200_OK
    assert res_apply.data["created"]["tables_count"] == 10
    assert res_apply.data["created"]["areas_count"] == 1
    assert DiningTable.objects.filter(branch=branch).count() == 10

    # 3. Mode 'new' fails on non-empty branch
    res_err = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/cafe_small/apply/",
        {"mode": "new"},
        format="json",
    )
    assert res_err.status_code == status.HTTP_400_BAD_REQUEST
    assert res_err.data["error"]["code"] == "BRANCH_NOT_EMPTY"


@pytest.mark.django_db
def test_template_restaurant_3_sections_golden_counts(venue_env):
    client = venue_env["client_owner"]
    branch = venue_env["branch"]

    res = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/restaurant_3_sections/apply/",
        {"mode": "new"},
        format="json",
    )
    assert res.status_code == status.HTTP_200_OK
    # 12 AC + 8 Family + 6 Outdoor = 26 tables
    assert res.data["created"]["tables_count"] == 26
    assert res.data["created"]["sections_count"] == 3
    assert DiningTable.objects.filter(branch=branch).count() == 26


@pytest.mark.django_db
def test_template_counters_zero_tables(venue_env):
    client = venue_env["client_owner"]
    branch = venue_env["branch"]

    res = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/counters/apply/",
        {"mode": "new", "params": {"count": 3, "names": ["Pickup Counter", "Juice Counter", "Express"]}},
        format="json",
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.data["created"]["tables_count"] == 0
    assert res.data["created"]["counters_count"] == 3
    assert DiningTable.objects.filter(branch=branch).count() == 0
    assert ServiceArea.objects.filter(branch=branch).count() == 3


@pytest.mark.django_db
def test_template_entitlement_limit_atomic_rollback(venue_env):
    client = venue_env["client_owner"]
    tenant = venue_env["tenant"]
    branch = venue_env["branch"]

    # Set plan max_tables = 15
    plan = Plan.objects.create(
        name="Basic Tier",
        slug="basic-tier",
        entitlements={"max_service_areas": 5, "max_tables": 15},
    )
    Subscription.objects.filter(tenant=tenant).update(plan=plan)

    # restaurant_3_sections requests 26 tables > 15 max_tables
    res = client.post(
        f"/api/v1/branches/{branch.id}/layout-templates/restaurant_3_sections/apply/",
        {"mode": "new"},
        format="json",
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert res.data["error"]["code"] == "ENTITLEMENT_LIMIT_REACHED"
    assert res.data["error"]["details"]["limit_key"] == "max_tables"
    assert res.data["error"]["details"]["limit"] == 15
    assert res.data["error"]["details"]["requested"] == 26

    # Atomicity: ZERO rows created
    assert ServiceArea.objects.filter(branch=branch).count() == 0
    assert DiningTable.objects.filter(branch=branch).count() == 0


@pytest.mark.django_db
def test_layout_template_permissions_and_isolation(venue_env):
    branch = venue_env["branch"]

    # Branch Manager has permission
    res_mgr = venue_env["client_mgr"].post(
        f"/api/v1/branches/{branch.id}/layout-templates/empty/apply/",
        {"mode": "new"},
        format="json",
    )
    assert res_mgr.status_code == status.HTTP_200_OK

    # Cashier is forbidden
    res_c = venue_env["client_cashier"].post(
        f"/api/v1/branches/{branch.id}/layout-templates/cafe_small/apply/",
        {"mode": "add"},
        format="json",
    )
    assert res_c.status_code == status.HTTP_403_FORBIDDEN

    # Foreign branch returns 404
    other_tenant = Tenant.objects.create(name="Other Cafe", slug="other-cafe")
    foreign_branch = Branch.objects.create(tenant=other_tenant, name="Foreign Branch")
    res_foreign = venue_env["client_owner"].post(
        f"/api/v1/branches/{foreign_branch.id}/layout-templates/empty/apply/",
        {"mode": "new"},
        format="json",
    )
    assert res_foreign.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_branded_qr_opencv_decoding_across_sizes_and_colors(venue_env):
    client = venue_env["client_owner"]
    tenant = venue_env["tenant"]
    branch = venue_env["branch"]

    # Create table and QR code
    sa = ServiceArea.objects.create(tenant=tenant, branch=branch, name="Main")
    from apps.venues.models import Section

    sec = Section.objects.create(tenant=tenant, branch=branch, service_area=sa, name="S1")
    table = DiningTable.objects.create(tenant=tenant, branch=branch, section=sec, label="T10")
    qr = generate_qr_code(branch=branch, target_type="TABLE", table=table)

    test_configs = [
        {"size": 250, "color": "#000000", "branded": "false"},
        {"size": 400, "color": "#0B1F3B", "branded": "true"},
        {"size": 500, "color": "#1E3A8A", "branded": "true"},
    ]

    detector = cv2.QRCodeDetector()

    for cfg in test_configs:
        res = client.get(
            f"/api/v1/qr-codes/{qr.id}/image/?size={cfg['size']}&color={cfg['color']}&branded={cfg['branded']}&format=png"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res["Content-Type"] == "image/png"

        # Decode with OpenCV
        image_bytes = res.content
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        assert img_cv is not None, "Failed to decode PNG with OpenCV"
        decoded_text, points, _ = detector.detectAndDecode(img_cv)

        assert decoded_text, f"Failed to decode QR code with config {cfg}"
        assert qr.public_token in decoded_text
        assert decoded_text.startswith("http://localhost:5173/q/")

    # Invalid QR color (contrast < 7:1 against white)
    res_bad_color = client.get(f"/api/v1/qr-codes/{qr.id}/image/?color=%23FFFF00")
    assert res_bad_color.status_code == status.HTTP_400_BAD_REQUEST
    assert res_bad_color.data["error"]["code"] == "INVALID_QR_COLOR"


@pytest.mark.django_db
def test_qr_sheet_data_and_public_endpoint(venue_env):
    client = venue_env["client_owner"]
    tenant = venue_env["tenant"]
    branch = venue_env["branch"]

    sa = ServiceArea.objects.create(tenant=tenant, branch=branch, name="Garden Area")
    from apps.venues.models import Section

    sec = Section.objects.create(tenant=tenant, branch=branch, service_area=sa, name="Patio")
    table = DiningTable.objects.create(tenant=tenant, branch=branch, section=sec, label="G1")
    qr = generate_qr_code(branch=branch, target_type="TABLE", table=table)

    # 1. Sheet Data endpoint
    res_sheet = client.get(f"/api/v1/qr-codes/sheet-data/?branch={branch.id}")
    assert res_sheet.status_code == status.HTTP_200_OK
    assert len(res_sheet.data) >= 1
    item = next(x for x in res_sheet.data if x["id"] == str(qr.id))
    assert item["label"] == "G1"
    assert item["area_name"] == "Garden Area"
    assert item["section_name"] == "Patio"
    assert item["public_url"].endswith(f"/q/{qr.public_token}")

    # 2. Public QR detail endpoint
    anon_client = APIClient()
    res_pub = anon_client.get(f"/api/v1/public/qr/{qr.public_token}/")
    assert res_pub.status_code == status.HTTP_200_OK
    assert res_pub.data["display_name"] == "Saravana Bhavan"
    assert res_pub.data["brand_primary_color"] == "#FF6A00"
    assert res_pub.data["table_label"] == "G1"

    # 3. Deactivated / Rotated token returns 404
    qr.is_active = False
    qr.save()
    res_rotated = anon_client.get(f"/api/v1/public/qr/{qr.public_token}/")
    assert res_rotated.status_code == status.HTTP_404_NOT_FOUND

    # 4. Unknown token returns 404
    res_unknown = anon_client.get("/api/v1/public/qr/non-existent-token/")
    assert res_unknown.status_code == status.HTTP_404_NOT_FOUND
