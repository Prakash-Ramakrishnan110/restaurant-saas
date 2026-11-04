import uuid

import pytest
from rest_framework import status

from apps.accounts.models import Membership
from apps.venues.models import TableGroup, TableSession
from apps.venues.services import generate_qr_code
from apps.venues.tests.conftest import make_client


@pytest.mark.django_db
@pytest.mark.parametrize(
    "resource_url_template",
    [
        "/api/v1/branches/{id}/",
        "/api/v1/service-areas/{id}/",
        "/api/v1/sections/{id}/",
        "/api/v1/tables/{id}/",
        "/api/v1/staff/{id}/",
        "/api/v1/table-sessions/{id}/",
        "/api/v1/table-groups/{id}/",
        "/api/v1/qr-codes/{id}/",
    ],
)
def test_foreign_id_in_url_returns_404_identical_to_random_uuid(
    venue_test_setup, resource_url_template
):
    """Foreign ID in URL returns 404 NOT_FOUND, identical to a random non-existent UUID."""
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])

    mem_b = Membership.objects.filter(tenant=venue_test_setup["tenant_b"]).first()
    assert mem_b is not None

    mapping = {
        "/api/v1/branches/{id}/": venue_test_setup["branch_b1"].id,
        "/api/v1/service-areas/{id}/": venue_test_setup["area_b1"].id,
        "/api/v1/sections/{id}/": venue_test_setup["sec_b1"].id,
        "/api/v1/tables/{id}/": venue_test_setup["table_b1_1"].id,
        "/api/v1/staff/{id}/": mem_b.id,
        "/api/v1/table-sessions/{id}/": TableSession.unscoped.create(
            tenant=venue_test_setup["tenant_b"],
            branch=venue_test_setup["branch_b1"],
            table=venue_test_setup["table_b1_1"],
        ).id,
        "/api/v1/table-groups/{id}/": TableGroup.unscoped.create(
            tenant=venue_test_setup["tenant_b"],
            branch=venue_test_setup["branch_b1"],
            label="Beta Group",
        ).id,
        "/api/v1/qr-codes/{id}/": generate_qr_code(
            branch=venue_test_setup["branch_b1"],
            target_type="TABLE",
            table=venue_test_setup["table_b1_1"],
        ).id,
    }

    foreign_id = mapping[resource_url_template]
    res_foreign = client_a.get(resource_url_template.format(id=foreign_id))
    assert res_foreign.status_code == status.HTTP_404_NOT_FOUND
    assert res_foreign.data["error"]["code"] == "NOT_FOUND"

    random_id = uuid.uuid4()
    res_random = client_a.get(resource_url_template.format(id=random_id))
    assert res_random.status_code == status.HTTP_404_NOT_FOUND
    assert res_foreign.data == res_random.data


@pytest.mark.django_db
def test_cross_tenant_body_payloads_return_400_invalid_reference(venue_test_setup):
    """Foreign ID in body returns 400 INVALID_REFERENCE, strictly identical to non-existent UUID."""
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch_a = venue_test_setup["branch_a1"]
    sec_a = venue_test_setup["sec_a1"]
    table_a = venue_test_setup["table_a1_1"]

    branch_b = venue_test_setup["branch_b1"]
    sec_b = venue_test_setup["sec_b1"]
    table_b = venue_test_setup["table_b1_1"]
    area_b = venue_test_setup["area_b1"]
    membership_b = Membership.objects.filter(tenant=venue_test_setup["tenant_b"]).first()
    assert membership_b is not None

    random_uuid = str(uuid.uuid4())

    # 1. POST /api/v1/tables/ (DiningTable creation with section)
    payload_foreign = {
        "branch": str(branch_a.id),
        "section": str(sec_b.id),
        "label": "T-Foreign",
        "capacity": 4,
    }
    payload_random = {
        "branch": str(branch_a.id),
        "section": random_uuid,
        "label": "T-Foreign",
        "capacity": 4,
    }
    res_f = client_a.post("/api/v1/tables/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/tables/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 2. POST /api/v1/sections/ (Section creation with service_area)
    payload_foreign = {
        "branch": str(branch_a.id),
        "service_area": str(area_b.id),
        "name": "Sec-Foreign",
    }
    payload_random = {
        "branch": str(branch_a.id),
        "service_area": random_uuid,
        "name": "Sec-Foreign",
    }
    res_f = client_a.post("/api/v1/sections/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/sections/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 3. POST /api/v1/tables/bulk-create/
    payload_foreign = {"branch_id": str(branch_a.id), "section_id": str(sec_b.id), "count": 2}
    payload_random = {"branch_id": str(branch_a.id), "section_id": random_uuid, "count": 2}
    res_f = client_a.post("/api/v1/tables/bulk-create/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/tables/bulk-create/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 4. POST /api/v1/tables/layout/
    payload_foreign = {"tables": [{"id": str(table_b.id), "x": 100, "y": 200}]}
    payload_random = {"tables": [{"id": random_uuid, "x": 100, "y": 200}]}
    res_f = client_a.post("/api/v1/tables/layout/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/tables/layout/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 5. POST /api/v1/qr-codes/generate/ with branch_id
    payload_foreign = {"branch_id": str(branch_b.id), "table_id": str(table_a.id)}
    payload_random = {"branch_id": random_uuid, "table_id": str(table_a.id)}
    res_f = client_a.post("/api/v1/qr-codes/generate/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/qr-codes/generate/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 6. POST /api/v1/qr-codes/generate/ with table_id
    payload_foreign = {"branch_id": str(branch_a.id), "table_id": str(table_b.id)}
    payload_random = {"branch_id": str(branch_a.id), "table_id": random_uuid}
    res_f = client_a.post("/api/v1/qr-codes/generate/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/qr-codes/generate/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 7. POST /api/v1/table-sessions/open/ with table_id
    payload_foreign = {"table_id": str(table_b.id), "guest_count": 2}
    payload_random = {"table_id": random_uuid, "guest_count": 2}
    res_f = client_a.post("/api/v1/table-sessions/open/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/table-sessions/open/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 8. POST /api/v1/tables/join/ with table_ids
    payload_foreign = {"table_ids": [str(table_a.id), str(table_b.id)], "label": "Join"}
    payload_random = {"table_ids": [str(table_a.id), random_uuid], "label": "Join"}
    res_f = client_a.post("/api/v1/tables/join/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/tables/join/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 9. POST /api/v1/tables/split/ with group_id
    payload_foreign = {"group_id": str(table_b.id)}
    payload_random = {"group_id": random_uuid}
    res_f = client_a.post("/api/v1/tables/split/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/tables/split/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data

    # 10. POST /api/v1/staff-assignments/ with membership
    payload_foreign = {
        "branch": str(branch_a.id),
        "membership": str(membership_b.id),
        "section": str(sec_a.id),
    }
    payload_random = {
        "branch": str(branch_a.id),
        "membership": random_uuid,
        "section": str(sec_a.id),
    }
    res_f = client_a.post("/api/v1/staff-assignments/", payload_foreign, format="json")
    res_r = client_a.post("/api/v1/staff-assignments/", payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data


@pytest.mark.django_db
def test_cross_branch_body_payloads_return_400_invalid_reference(venue_test_setup):
    """Same tenant, different branch references in body return 400 INVALID_REFERENCE identical to random UUID."""
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch_a1 = venue_test_setup["branch_a1"]
    branch_a2 = venue_test_setup["branch_a2"]

    # Create service area and section in Branch A2
    area_a2 = venue_test_setup["area_a1"].__class__.objects.create(
        tenant=venue_test_setup["tenant_a"],
        branch=branch_a2,
        name="Branch A2 Area",
    )
    sec_a2 = venue_test_setup["sec_a1"].__class__.objects.create(
        tenant=venue_test_setup["tenant_a"],
        branch=branch_a2,
        service_area=area_a2,
        name="Branch A2 Section",
    )

    random_uuid = str(uuid.uuid4())

    # Branch A1 table referring to Branch A2 section
    payload_cross_branch = {
        "branch": str(branch_a1.id),
        "section": str(sec_a2.id),
        "label": "T-CrossBranch",
        "capacity": 4,
    }
    payload_random = {
        "branch": str(branch_a1.id),
        "section": random_uuid,
        "label": "T-CrossBranch",
        "capacity": 4,
    }
    res_cb = client_a.post("/api/v1/tables/", payload_cross_branch, format="json")
    res_rnd = client_a.post("/api/v1/tables/", payload_random, format="json")
    assert res_cb.status_code == 400
    assert res_cb.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_cb.data == res_rnd.data

    # Branch A1 section referring to Branch A2 service area
    payload_cross_branch_sec = {
        "branch": str(branch_a1.id),
        "service_area": str(area_a2.id),
        "name": "Sec-CrossBranch",
    }
    payload_random_sec = {
        "branch": str(branch_a1.id),
        "service_area": random_uuid,
        "name": "Sec-CrossBranch",
    }
    res_cb_sec = client_a.post("/api/v1/sections/", payload_cross_branch_sec, format="json")
    res_rnd_sec = client_a.post("/api/v1/sections/", payload_random_sec, format="json")
    assert res_cb_sec.status_code == 400
    assert res_cb_sec.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_cb_sec.data == res_rnd_sec.data
