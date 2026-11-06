import io

import pytest
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.rbac.constants import Role
from apps.tenants.models import BusinessSettings, Tenant


@pytest.fixture
def auth_setup(django_db_blocker):
    with django_db_blocker.unblock():
        from django.contrib.auth import get_user_model

        User = get_user_model()
        tenant = Tenant.objects.create(name="Biryani Palace", slug="biryani-palace")
        owner = User.objects.create_user(
            email="owner@biryanipalace.com", password="Password123!", full_name="Owner User"
        )
        membership = Membership.objects.create(
            user=owner, tenant=tenant, role=Role.OWNER, is_active=True
        )

        client = APIClient()
        token = str(RefreshToken.for_user(owner).access_token)
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_X_TENANT_ID=str(tenant.id),
        )

        from apps.core.context import set_current_tenant

        set_current_tenant(tenant)

        return {"tenant": tenant, "owner": owner, "membership": membership, "client": client}


@pytest.mark.django_db
def test_business_fields_patch_and_get(auth_setup):
    client = auth_setup["client"]
    tenant = auth_setup["tenant"]

    # Initial GET
    res = client.get("/api/v1/business/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["name"] == "Biryani Palace"
    assert res.data["brand_primary_color"] == "#FF6A00"
    assert res.data["document_language"] == "EN"

    # Valid PATCH
    patch_data = {
        "legal_name": "Biryani Palace Foods Pvt Ltd",
        "gstin": "33AAAAA0000A1Z5",
        "registered_address": "123 Anna Salai, Chennai, TN 600002",
        "document_language": "EN_TA",
        "brand_primary_color": "#0B1F3B",
        "receipt_footer_text": "Thank you for dining with us! Visit again.",
    }
    res_patch = client.patch("/api/v1/business/", patch_data, format="json")
    assert res_patch.status_code == status.HTTP_200_OK
    assert res_patch.data["legal_name"] == "Biryani Palace Foods Pvt Ltd"
    assert res_patch.data["gstin"] == "33AAAAA0000A1Z5"
    assert res_patch.data["registered_address"] == "123 Anna Salai, Chennai, TN 600002"
    assert res_patch.data["document_language"] == "EN_TA"
    assert res_patch.data["brand_primary_color"] == "#0B1F3B"
    assert res_patch.data["receipt_footer_text"] == "Thank you for dining with us! Visit again."

    # Audit log entry created
    audit = AuditLog.objects.filter(tenant=tenant, action="business.update").first()
    assert audit is not None
    assert audit.after_state["legal_name"] == "Biryani Palace Foods Pvt Ltd"


@pytest.mark.django_db
def test_business_gstin_validation(auth_setup):
    client = auth_setup["client"]

    # Invalid GSTIN format
    res = client.patch("/api/v1/business/", {"gstin": "12345INVALID"}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error"]["code"] in ("INVALID_GSTIN", "VALIDATION_ERROR")


@pytest.mark.django_db
def test_business_brand_color_contrast_validation(auth_setup):
    client = auth_setup["client"]

    # High contrast colors pass
    res_navy = client.patch("/api/v1/business/", {"brand_primary_color": "#0B1F3B"}, format="json")
    assert res_navy.status_code == status.HTTP_200_OK

    res_orange = client.patch(
        "/api/v1/business/", {"brand_primary_color": "#FF6A00"}, format="json"
    )
    assert res_orange.status_code == status.HTTP_200_OK

    # Color failing both white and navy (< 4.5:1)
    # #808080 has ratio ~3.95 against white and ~4.18 against navy
    res_low = client.patch("/api/v1/business/", {"brand_primary_color": "#808080"}, format="json")
    assert res_low.status_code == status.HTTP_400_BAD_REQUEST
    assert res_low.data["error"]["code"] == "INVALID_BRAND_COLOR"


@pytest.mark.django_db
def test_logo_upload_png_success(auth_setup):
    client = auth_setup["client"]
    tenant = auth_setup["tenant"]

    # Create dummy PNG image
    img = Image.new("RGBA", (200, 200), color=(255, 106, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "logo.png"

    res = client.post("/api/v1/business/logo/", {"logo": buf}, format="multipart")
    assert res.status_code == status.HTTP_200_OK
    assert "logo_url" in res.data
    assert "logo_128_url" in res.data
    assert res.headers.get("X-Content-Type-Options") == "nosniff"

    # Settings updated
    settings_obj = BusinessSettings.unscoped.get(tenant=tenant)
    assert settings_obj.logo_url == res.data["logo_url"]
    assert settings_obj.logo_128_url == res.data["logo_128_url"]

    # Audit log
    audit = AuditLog.objects.filter(tenant=tenant, action="business.logo_upload").first()
    assert audit is not None


@pytest.mark.django_db
def test_logo_upload_rejects_svg(auth_setup):
    client = auth_setup["client"]

    # Reject by extension
    svg_data = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='50'/></svg>"
    buf = io.BytesIO(svg_data)
    buf.name = "logo.svg"
    res = client.post("/api/v1/business/logo/", {"logo": buf}, format="multipart")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error"]["code"] == "INVALID_IMAGE_FORMAT"

    # Reject disguised SVG with .png extension
    buf2 = io.BytesIO(svg_data)
    buf2.name = "fake.png"
    res2 = client.post("/api/v1/business/logo/", {"logo": buf2}, format="multipart")
    assert res2.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_logo_upload_rejects_oversized_dimensions(auth_setup):
    client = auth_setup["client"]

    # Mock dimensions check: 4001x100
    img = Image.new("RGB", (4001, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "wide.png"

    res = client.post("/api/v1/business/logo/", {"logo": buf}, format="multipart")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error"]["code"] == "IMAGE_DIMENSIONS_TOO_LARGE"


@pytest.mark.django_db
def test_logo_delete(auth_setup):
    client = auth_setup["client"]
    tenant = auth_setup["tenant"]

    # Upload first
    img = Image.new("RGBA", (100, 100), color=(0, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "logo.png"
    client.post("/api/v1/business/logo/", {"logo": buf}, format="multipart")

    # DELETE logo
    res_del = client.delete("/api/v1/business/logo/")
    assert res_del.status_code == status.HTTP_200_OK
    assert res_del.data["logo_url"] == ""

    settings_obj = BusinessSettings.unscoped.get(tenant=tenant)
    assert settings_obj.logo_url == ""
    assert settings_obj.logo_128_url == ""

    # Audit log
    assert AuditLog.objects.filter(tenant=tenant, action="business.logo_delete").exists()
