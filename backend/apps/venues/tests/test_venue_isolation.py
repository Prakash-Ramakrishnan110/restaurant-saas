import pytest

from apps.venues.tests.conftest import make_client


@pytest.mark.django_db
def test_cross_tenant_isolation_returns_404(venue_test_setup):
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])

    area_b = venue_test_setup["area_b1"]
    sec_b = venue_test_setup["sec_b1"]
    table_b = venue_test_setup["table_b1_1"]

    # Tenant A attempts to view Tenant B's service area
    res_area = client_a.get(f"/api/v1/service-areas/{area_b.id}/")
    assert res_area.status_code == 404

    # Tenant A attempts to view Tenant B's section
    res_sec = client_a.get(f"/api/v1/sections/{sec_b.id}/")
    assert res_sec.status_code == 404

    # Tenant A attempts to view Tenant B's table
    res_table = client_a.get(f"/api/v1/tables/{table_b.id}/")
    assert res_table.status_code == 404


@pytest.mark.django_db
def test_cross_branch_scope_isolation_returns_404(venue_test_setup):
    # Manager A1 is scoped only to Branch A1
    client_mgr_a1 = make_client(venue_test_setup["manager_a1"], venue_test_setup["tenant_a"])
    branch_a2 = venue_test_setup["branch_a2"]

    # Manager A1 attempts to access Branch A2's capabilities
    res_cap = client_mgr_a1.get(f"/api/v1/branches/{branch_a2.id}/capabilities/")
    assert res_cap.status_code == 404


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
    assert res_bulk.status_code == 403

    # Attempt to generate QR code
    res_qr = client_waiter.post(
        "/api/v1/qr-codes/generate/",
        {
            "branch_id": str(venue_test_setup["branch_a1"].id),
            "table_id": str(venue_test_setup["table_a1_1"].id),
        },
    )
    assert res_qr.status_code == 403
