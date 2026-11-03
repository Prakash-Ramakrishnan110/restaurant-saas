import pytest

from apps.venues.constants import AreaType, TableShape, TableType
from apps.venues.tests.conftest import make_client


@pytest.mark.django_db
def test_branch_capabilities_patch(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]

    # GET capabilities
    res_get = client.get(f"/api/v1/branches/{branch.id}/capabilities/")
    assert res_get.status_code == 200

    # PATCH capabilities
    res_patch = client.patch(
        f"/api/v1/branches/{branch.id}/capabilities/",
        {"uses_token_numbers": True, "allows_takeaway": True},
    )
    assert res_patch.status_code == 200
    assert res_patch.data["uses_token_numbers"] is True


@pytest.mark.django_db
def test_service_area_viewset_crud(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]

    # List
    res_list = client.get("/api/v1/service-areas/", {"branch_id": str(branch.id)})
    assert res_list.status_code == 200

    # Create
    res_create = client.post(
        "/api/v1/service-areas/",
        {
            "branch": str(branch.id),
            "name": "Rooftop Terrace",
            "area_type": AreaType.OUTDOOR,
            "service_charge_bps": 200,
        },
    )
    assert res_create.status_code == 201
    area_id = res_create.data["id"]

    # Retrieve
    res_retrieve = client.get(f"/api/v1/service-areas/{area_id}/")
    assert res_retrieve.status_code == 200
    assert res_retrieve.data["name"] == "Rooftop Terrace"

    # Update
    res_update = client.patch(
        f"/api/v1/service-areas/{area_id}/",
        {"name": "Rooftop Lounge"},
    )
    assert res_update.status_code == 200
    assert res_update.data["name"] == "Rooftop Lounge"

    # Delete
    res_delete = client.delete(f"/api/v1/service-areas/{area_id}/")
    assert res_delete.status_code == 204


@pytest.mark.django_db
def test_section_viewset_crud(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    area = venue_test_setup["area_a1"]

    # Create
    res_create = client.post(
        "/api/v1/sections/",
        {
            "branch": str(branch.id),
            "service_area": str(area.id),
            "name": "VIP Booths",
            "color": "#EF4444",
        },
    )
    assert res_create.status_code == 201
    section_id = res_create.data["id"]

    # List & Retrieve
    res_list = client.get("/api/v1/sections/", {"service_area_id": str(area.id)})
    assert res_list.status_code == 200
    res_retrieve = client.get(f"/api/v1/sections/{section_id}/")
    assert res_retrieve.status_code == 200

    # Delete
    res_delete = client.delete(f"/api/v1/sections/{section_id}/")
    assert res_delete.status_code == 204


@pytest.mark.django_db
def test_dining_table_bulk_create_and_layout(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    sec = venue_test_setup["sec_a1"]

    # Bulk create tables
    res_bulk = client.post(
        "/api/v1/tables/bulk-create/",
        {
            "branch_id": str(branch.id),
            "section_id": str(sec.id),
            "prefix": "B",
            "start_number": 1,
            "count": 3,
            "capacity": 4,
            "table_type": TableType.BOOTH,
            "shape": TableShape.BOOTH,
        },
    )
    assert res_bulk.status_code == 201
    assert len(res_bulk.data) == 3
    t1_id = res_bulk.data[0]["id"]

    # Floor layout update
    res_layout = client.patch(
        "/api/v1/tables/layout/",
        {
            "tables": [
                {
                    "id": t1_id,
                    "x": 200.0,
                    "y": 150.0,
                    "width": 100.0,
                    "height": 100.0,
                    "rotation": 45,
                    "shape": TableShape.ROUND,
                }
            ]
        },
        format="json",
    )
    assert res_layout.status_code == 200
    assert "Updated layout" in res_layout.data["detail"]


@pytest.mark.django_db
def test_qr_code_viewset_actions(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]

    # Generate QR
    res_gen = client.post(
        "/api/v1/qr-codes/generate/",
        {"branch_id": str(branch.id), "table_id": str(table.id)},
    )
    assert res_gen.status_code == 201
    qr_id = res_gen.data["id"]

    # List
    res_list = client.get("/api/v1/qr-codes/", {"branch_id": str(branch.id)})
    assert res_list.status_code == 200

    # Rotate QR
    res_rot = client.post(f"/api/v1/qr-codes/{qr_id}/rotate/")
    assert res_rot.status_code == 200
    assert res_rot.data["version"] == 2

    # Get image
    res_img = client.get(f"/api/v1/qr-codes/{qr_id}/image/?format=png")
    assert res_img.status_code == 200
    assert res_img["Content-Type"] == "image/png"

    res_svg = client.get(f"/api/v1/qr-codes/{qr_id}/image/?format=svg")
    assert res_svg.status_code == 200
    assert res_svg["Content-Type"] == "image/svg+xml"

    # Deactivate
    res_deact = client.post(f"/api/v1/qr-codes/{qr_id}/deactivate/")
    assert res_deact.status_code == 200


@pytest.mark.django_db
def test_staff_section_assignment(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    sec = venue_test_setup["sec_a1"]
    membership = venue_test_setup["waiter_a1"].memberships.first()

    # Create assignment
    res_assign = client.post(
        "/api/v1/staff-assignments/",
        {
            "branch": str(venue_test_setup["branch_a1"].id),
            "section": str(sec.id),
            "membership": str(membership.id),
        },
    )
    assert res_assign.status_code == 201
    assignment_id = res_assign.data["id"]

    # List assignments
    res_list = client.get("/api/v1/staff-assignments/")
    assert res_list.status_code == 200

    # Delete assignment
    res_del = client.delete(f"/api/v1/staff-assignments/{assignment_id}/")
    assert res_del.status_code == 204


@pytest.mark.django_db
def test_table_sessions_list_and_filter(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]

    res = client.get("/api/v1/table-sessions/", {"branch_id": str(branch.id)})
    assert res.status_code == 200


@pytest.mark.django_db
def test_table_groups_viewset(venue_test_setup):
    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    res = client.get("/api/v1/table-groups/")
    assert res.status_code == 200
