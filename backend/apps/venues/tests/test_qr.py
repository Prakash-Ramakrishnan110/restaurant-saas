import pytest
from rest_framework.test import APIClient

from apps.tenants.models import Tenant
from apps.venues.constants import QRTargetType
from apps.venues.services import (
    deactivate_qr_code,
    generate_qr_code,
    render_qr_image,
    rotate_qr_code,
)


@pytest.mark.django_db
def test_qr_generation_and_rotation(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]

    qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)
    assert len(qr.public_token) >= 24
    assert qr.version == 1
    assert qr.is_active is True

    old_token = qr.public_token
    rotated = rotate_qr_code(qr)
    assert rotated.version == 2
    assert rotated.public_token != old_token

    deactivate_qr_code(rotated)
    assert rotated.is_active is False


@pytest.mark.django_db
def test_qr_image_rendering(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]
    qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)

    png_bytes, content_type_png = render_qr_image(qr, "png")
    assert content_type_png == "image/png"
    assert len(png_bytes) > 0

    svg_bytes, content_type_svg = render_qr_image(qr, "svg")
    assert content_type_svg == "image/svg+xml"
    assert b"<svg" in svg_bytes


@pytest.mark.django_db
def test_public_qr_flow(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]
    qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)

    anon_client = APIClient()

    # 1. Resolve QR token publicly
    detail_res = anon_client.get(f"/api/v1/public/qr/{qr.public_token}/")
    assert detail_res.status_code == 200
    assert detail_res.data["tenant_name"] == venue_test_setup["tenant_a"].name
    assert detail_res.data["table_label"] == "T1"
    # Ensure no internal IDs or admin details leaked
    assert "id" not in detail_res.data
    assert "token" not in detail_res.data

    # 2. Customer opens session
    open_res = anon_client.post(
        f"/api/v1/public/qr/{qr.public_token}/session/",
        {"guest_count": 2},
    )
    assert open_res.status_code == 201
    assert "session_code" in open_res.data
    assert "session_token" in open_res.data

    # 3. Customer rejoins same table (returns existing session)
    rejoin_res = anon_client.post(
        f"/api/v1/public/qr/{qr.public_token}/session/",
        {"guest_count": 1},
    )
    assert rejoin_res.status_code == 200
    assert rejoin_res.data["session_code"] == open_res.data["session_code"]


@pytest.mark.django_db
def test_suspended_tenant_public_qr_returns_404(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]
    qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)

    # Suspend tenant
    tenant = venue_test_setup["tenant_a"]
    tenant.status = Tenant.Status.SUSPENDED
    tenant.save()

    anon_client = APIClient()
    res = anon_client.get(f"/api/v1/public/qr/{qr.public_token}/")
    assert res.status_code == 404

