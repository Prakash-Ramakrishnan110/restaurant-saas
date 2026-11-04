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


@pytest.mark.django_db
def test_qr_entropy_and_uniqueness(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]

    tokens = set()
    for _ in range(30):
        qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)
        assert len(qr.public_token) >= 32
        # Check URL safe character set
        assert all(c.isalnum() or c in "-_" for c in qr.public_token)
        tokens.add(qr.public_token)
        deactivate_qr_code(qr)

    assert len(tokens) == 30


@pytest.mark.django_db
def test_rotated_and_inactive_token_returns_404(venue_test_setup):
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]
    qr = generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)
    old_token = qr.public_token

    anon_client = APIClient()
    # Active token succeeds
    assert anon_client.get(f"/api/v1/public/qr/{old_token}/").status_code == 200

    # Rotate QR code
    rotated = rotate_qr_code(qr)
    new_token = rotated.public_token

    # Old token is now inactive/replaced -> returns 404
    assert anon_client.get(f"/api/v1/public/qr/{old_token}/").status_code == 404
    # New token succeeds
    assert anon_client.get(f"/api/v1/public/qr/{new_token}/").status_code == 200

    # Deactivate new token -> returns 404
    deactivate_qr_code(rotated)
    assert anon_client.get(f"/api/v1/public/qr/{new_token}/").status_code == 404


@pytest.mark.django_db
def test_qr_tenant_isolation(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    branch_a = venue_test_setup["branch_a1"]
    table_a = venue_test_setup["table_a1_1"]
    qr_a = generate_qr_code(branch=branch_a, target_type=QRTargetType.TABLE, table=table_a)

    tenant_b = venue_test_setup["tenant_b"]
    owner_b = venue_test_setup["owner_b"]

    client_b = make_client(owner_b, tenant_b)

    # Tenant B tries to rotate Tenant A's QR code -> 404
    res_rotate = client_b.post(f"/api/v1/qr-codes/{qr_a.id}/rotate/")
    assert res_rotate.status_code == 404


@pytest.mark.django_db
def test_qr_generate_idempotency_and_deactivation_api(venue_test_setup):
    from apps.venues.models import QRCode
    from apps.venues.tests.conftest import make_client

    branch_a = venue_test_setup["branch_a1"]
    table_a = venue_test_setup["table_a1_1"]
    owner_a = venue_test_setup["owner_a"]
    tenant_a = venue_test_setup["tenant_a"]

    client = make_client(owner_a, tenant_a)

    # 1. First generate QR code -> 201 Created
    res1 = client.post(
        "/api/v1/qr-codes/generate/",
        {"branch_id": str(branch_a.id), "table_id": str(table_a.id), "target_type": "TABLE"},
        format="json",
    )
    assert res1.status_code == 201
    qr_id = res1.data["id"]
    token = res1.data["public_token"]
    assert QRCode.unscoped.filter(branch=branch_a, table=table_a, is_active=True).count() == 1

    # 2. Idempotent repeat call with same target -> 200 OK returning same QR code, no duplicate row
    res2 = client.post(
        "/api/v1/qr-codes/generate/",
        {"branch_id": str(branch_a.id), "table_id": str(table_a.id), "target_type": "TABLE"},
        format="json",
    )
    assert res2.status_code == 200
    assert res2.data["id"] == qr_id
    assert res2.data["public_token"] == token
    assert QRCode.unscoped.filter(branch=branch_a, table=table_a, is_active=True).count() == 1

    # 3. Deactivate via DELETE /api/v1/qr-codes/{id}/ -> 204 No Content
    res_del = client.delete(f"/api/v1/qr-codes/{qr_id}/")
    assert res_del.status_code == 204
    assert QRCode.unscoped.filter(branch=branch_a, table=table_a, is_active=True).count() == 0

    # 4. Generate again after deactivation -> creates fresh active QR code (201 Created)
    res3 = client.post(
        "/api/v1/qr-codes/generate/",
        {"branch_id": str(branch_a.id), "table_id": str(table_a.id), "target_type": "TABLE"},
        format="json",
    )
    assert res3.status_code == 201
    new_qr_id = res3.data["id"]
    assert new_qr_id != qr_id
