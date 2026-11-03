import pytest
from rest_framework import status

from apps.accounts.models import Membership
from apps.venues.models import TableGroup, TableSession
from apps.venues.tests.conftest import make_client


@pytest.mark.django_db
def test_cross_tenant_isolation_returns_404(venue_test_setup):
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])

    area_b = venue_test_setup["area_b1"]
    sec_b = venue_test_setup["sec_b1"]
    table_b = venue_test_setup["table_b1_1"]

    # Tenant A attempts to view Tenant B's service area
    res_area = client_a.get(f"/api/v1/service-areas/{area_b.id}/")
    assert res_area.status_code == status.HTTP_404_NOT_FOUND

    # Tenant A attempts to view Tenant B's section
    res_sec = client_a.get(f"/api/v1/sections/{sec_b.id}/")
    assert res_sec.status_code == status.HTTP_404_NOT_FOUND

    # Tenant A attempts to view Tenant B's table
    res_table = client_a.get(f"/api/v1/tables/{table_b.id}/")
    assert res_table.status_code == status.HTTP_404_NOT_FOUND

    # Tenant A attempts to view Tenant B's staff member
    membership_b = Membership.objects.filter(tenant=venue_test_setup["tenant_b"]).first()
    assert membership_b is not None
    assert membership_b is not None
    res_staff = client_a.get(f"/api/v1/staff/{membership_b.id}/")
    assert res_staff.status_code == status.HTTP_404_NOT_FOUND

    # Tenant A attempts to view Tenant B's table session
    session_b = TableSession.unscoped.create(
        tenant=venue_test_setup["tenant_b"],
        branch=venue_test_setup["branch_b1"],
        table=table_b,
    )
    res_session = client_a.get(f"/api/v1/table-sessions/{session_b.id}/")
    assert res_session.status_code == status.HTTP_404_NOT_FOUND

    # Tenant A attempts to view Tenant B's table group
    group_b = TableGroup.unscoped.create(
        tenant=venue_test_setup["tenant_b"],
        branch=venue_test_setup["branch_b1"],
        label="Group Beta",
    )
    res_group = client_a.get(f"/api/v1/table-groups/{group_b.id}/")
    assert res_group.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_cross_tenant_payload_rejection_returns_404(venue_test_setup):
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch_a = venue_test_setup["branch_a1"]
    sec_a = venue_test_setup["sec_a1"]
    table_a = venue_test_setup["table_a1_1"]

    branch_b = venue_test_setup["branch_b1"]
    sec_b = venue_test_setup["sec_b1"]
    table_b = venue_test_setup["table_b1_1"]
    membership_b = Membership.objects.filter(tenant=venue_test_setup["tenant_b"]).first()
    assert membership_b is not None

    # 1. tables/bulk-create with cross-tenant section
    res_bulk = client_a.post(
        "/api/v1/tables/bulk-create/",
        {
            "branch_id": str(branch_a.id),
            "section_id": str(sec_b.id),
            "count": 2,
        },
    )
    assert res_bulk.status_code == status.HTTP_404_NOT_FOUND

    # 2. tables/layout with cross-tenant table
    res_layout = client_a.post(
        "/api/v1/tables/layout/",
        {
            "tables": [
                {"id": str(table_b.id), "x": 100, "y": 200},
            ]
        },
        format="json",
    )
    assert res_layout.status_code == status.HTTP_404_NOT_FOUND

    # 3. qr-codes/generate with cross-tenant branch
    res_qr_branch = client_a.post(
        "/api/v1/qr-codes/generate/",
        {
            "branch_id": str(branch_b.id),
            "table_id": str(table_a.id),
        },
    )
    assert res_qr_branch.status_code == status.HTTP_404_NOT_FOUND

    # 4. qr-codes/generate with cross-tenant table
    res_qr_table = client_a.post(
        "/api/v1/qr-codes/generate/",
        {
            "branch_id": str(branch_a.id),
            "table_id": str(table_b.id),
        },
    )
    assert res_qr_table.status_code == status.HTTP_404_NOT_FOUND

    # 5. table-sessions/open with cross-tenant table
    res_session = client_a.post(
        "/api/v1/table-sessions/open/",
        {
            "table_id": str(table_b.id),
            "guest_count": 2,
        },
    )
    assert res_session.status_code == status.HTTP_404_NOT_FOUND

    # 6. tables/join with cross-tenant table
    res_join = client_a.post(
        "/api/v1/tables/join/",
        {
            "table_ids": [str(table_a.id), str(table_b.id)],
            "label": "Joined AB",
        },
    )
    assert res_join.status_code == status.HTTP_404_NOT_FOUND

    # 7. staff-assignments with cross-tenant section
    res_assign_sec = client_a.post(
        "/api/v1/staff-assignments/",
        {
            "branch": str(branch_a.id),
            "membership": str(venue_test_setup["waiter_a1"].memberships.first().id),
            "section": str(sec_b.id),
        },
    )
    assert res_assign_sec.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND)

    # 8. staff-assignments with cross-tenant membership
    res_assign_mem = client_a.post(
        "/api/v1/staff-assignments/",
        {
            "branch": str(branch_a.id),
            "membership": str(membership_b.id),
            "section": str(sec_a.id),
        },
    )
    assert res_assign_mem.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND)


@pytest.mark.django_db
def test_cross_branch_scope_isolation_returns_404(venue_test_setup):
    # Manager A1 is scoped only to Branch A1
    client_mgr_a1 = make_client(venue_test_setup["manager_a1"], venue_test_setup["tenant_a"])
    branch_a2 = venue_test_setup["branch_a2"]

    # Manager A1 attempts to access Branch A2's capabilities
    res_cap = client_mgr_a1.get(f"/api/v1/branches/{branch_a2.id}/capabilities/")
    assert res_cap.status_code == status.HTTP_404_NOT_FOUND

    # Manager A1 attempts to access tables in Branch A2
    res_tables = client_mgr_a1.get(f"/api/v1/tables/?branch_id={branch_a2.id}")
    assert res_tables.status_code == status.HTTP_200_OK
    assert res_tables.data["results"] == []


@pytest.mark.django_db
def test_rbac_permission_enforcement(venue_test_setup):
    # Waiter cannot manage floor layout or generate QR codes
    client_waiter = make_client(venue_test_setup["waiter_a1"], venue_test_setup["tenant_a"])

    # Attempt to bulk create tables
    res_bulk = client_waiter.post(
        "/api/v1/tables/bulk-create/",
        {
            "branch_id": str(venue_test_setup["branch_a1"].id),
            "section_id": str(venue_test_setup["sec_a1"].id),
            "count": 5,
        },
    )
    assert res_bulk.status_code == status.HTTP_403_FORBIDDEN

    # Attempt to generate QR code
    res_qr = client_waiter.post(
        "/api/v1/qr-codes/generate/",
        {
            "branch_id": str(venue_test_setup["branch_a1"].id),
            "table_id": str(venue_test_setup["table_a1_1"].id),
        },
    )
    assert res_qr.status_code == status.HTTP_403_FORBIDDEN
