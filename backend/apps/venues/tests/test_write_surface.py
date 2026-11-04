import pytest
from rest_framework import status

from apps.venues.models import DiningTable, QRCode, TableSession
from apps.venues.services import generate_qr_code, open_session
from apps.venues.tests.conftest import make_client

# (method, url template) pairs that must NOT exist. {t} table, {s} session, {q} qr, {a} assignment
REMOVED_ROUTES = [
    ("post", "/api/v1/table-sessions/"),
    ("put", "/api/v1/table-sessions/{s}/"),
    ("patch", "/api/v1/table-sessions/{s}/"),
    ("delete", "/api/v1/table-sessions/{s}/"),
    ("post", "/api/v1/qr-codes/"),
    ("put", "/api/v1/qr-codes/{q}/"),
    ("patch", "/api/v1/qr-codes/{q}/"),
    ("put", "/api/v1/staff-assignments/{a}/"),
    ("patch", "/api/v1/staff-assignments/{a}/"),
    ("put", "/api/v1/service-areas/{area}/"),
    ("put", "/api/v1/sections/{sec}/"),
    ("put", "/api/v1/tables/{t}/"),
    ("patch", "/api/v1/tables/layout/"),
    ("put", "/api/v1/tables/layout/"),
    ("post", "/api/v1/qr-codes/{q}/deactivate/"),
    ("post", "/api/v1/auth/token/refresh/"),
]


@pytest.fixture
def surface(venue_test_setup):
    from apps.accounts.models import Membership
    from apps.venues.models import StaffSectionAssignment

    s = venue_test_setup
    session = open_session(branch=s["branch_a1"], table=s["table_a1_1"])
    qr = generate_qr_code(branch=s["branch_a1"], target_type="TABLE", table=s["table_a1_2"])
    membership = Membership.objects.get(user=s["waiter_a1"], tenant=s["tenant_a"])
    assignment = StaffSectionAssignment.unscoped.create(
        tenant=s["tenant_a"], branch=s["branch_a1"], section=s["sec_a1"], membership=membership
    )
    ids = {
        "t": s["table_a1_1"].id,
        "s": session.id,
        "q": qr.id,
        "a": assignment.id,
        "area": s["area_a1"].id,
        "sec": s["sec_a1"].id,
    }
    return s, ids


@pytest.mark.django_db
@pytest.mark.parametrize("method,template", REMOVED_ROUTES)
def test_removed_write_routes_return_405_or_404(surface, method, template):
    s, ids = surface
    client = make_client(s["owner_a"], s["tenant_a"])
    url = template.format(**ids)
    res = getattr(client, method)(url, {}, format="json")
    # 405 for removed methods on existing routes; 404 for routes that no longer exist at all
    assert res.status_code in (status.HTTP_405_METHOD_NOT_ALLOWED, status.HTTP_404_NOT_FOUND)
    if "deactivate" not in template and "token/refresh" not in template:
        assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
def test_patch_table_cannot_change_status(surface):
    s, ids = surface
    client = make_client(s["owner_a"], s["tenant_a"])
    table = DiningTable.objects.get(pk=s["table_a1_2"].id)
    before = table.status
    res = client.patch(
        f"/api/v1/tables/{table.id}/", {"status": "BLOCKED", "capacity": 6}, format="json"
    )
    assert res.status_code == 200
    table.refresh_from_db()
    assert table.status == before
    assert table.capacity == 6


@pytest.mark.django_db
def test_sessions_can_only_be_created_through_open(surface):
    s, ids = surface
    client = make_client(s["owner_a"], s["tenant_a"])
    before = TableSession.objects.count()
    res = client.post(
        "/api/v1/table-sessions/",
        {"branch": str(s["branch_a1"].id), "table": str(s["table_a1_2"].id), "status": "OPEN"},
        format="json",
    )
    assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert TableSession.objects.count() == before
    ok = client.post(
        "/api/v1/table-sessions/open/", {"table_id": str(s["table_a1_2"].id)}, format="json"
    )
    assert ok.status_code == 201


@pytest.mark.django_db
def test_qr_token_and_active_flag_cannot_be_overwritten(surface):
    s, ids = surface
    client = make_client(s["owner_a"], s["tenant_a"])
    qr = QRCode.unscoped.get(pk=ids["q"])
    token = qr.public_token
    res = client.patch(
        f"/api/v1/qr-codes/{qr.id}/",
        {"public_token": "hacked", "is_active": False},
        format="json",
    )
    assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    qr.refresh_from_db()
    assert qr.public_token == token and qr.is_active


@pytest.mark.django_db
def test_qr_delete_is_soft_deactivate(surface):
    s, ids = surface
    client = make_client(s["owner_a"], s["tenant_a"])
    res = client.delete(f"/api/v1/qr-codes/{ids['q']}/")
    assert res.status_code == 204
    assert QRCode.unscoped.get(pk=ids["q"]).is_active is False
