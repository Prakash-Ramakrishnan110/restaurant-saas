import uuid

import pytest
from rest_framework import status

from apps.accounts.models import Membership
from apps.venues.models import (
    DiningTable,
    Section,
    ServiceArea,
    StaffSectionAssignment,
    TableGroup,
    TableSession,
)
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
        "/api/v1/staff-assignments/{id}/",
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
        "/api/v1/staff-assignments/{id}/": StaffSectionAssignment.unscoped.create(
            tenant=venue_test_setup["tenant_b"],
            branch=venue_test_setup["branch_b1"],
            section=venue_test_setup["sec_b1"],
            membership=mem_b,
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
@pytest.mark.parametrize(
    "role_key, resource_url_template",
    [
        ("manager_a1", "/api/v1/sections/{id}/"),
        ("manager_a1", "/api/v1/tables/{id}/"),
        ("manager_a1", "/api/v1/table-sessions/{id}/"),
        ("manager_a1", "/api/v1/qr-codes/{id}/"),
        ("manager_a1", "/api/v1/staff-assignments/{id}/"),
        ("waiter_a1", "/api/v1/tables/{id}/"),
        ("waiter_a1", "/api/v1/table-sessions/{id}/"),
    ],
)
def test_branch_scoped_roles_url_isolation_returns_404_identical_to_random_uuid(
    venue_test_setup, role_key, resource_url_template
):
    """Branch-scoped roles (manager and waiter of branch_a1) get 404 identical to random UUID when requesting branch_a2 resources."""
    user = venue_test_setup[role_key]
    tenant_a = venue_test_setup["tenant_a"]
    branch_a2 = venue_test_setup["branch_a2"]

    area_a2 = ServiceArea.unscoped.create(tenant=tenant_a, branch=branch_a2, name="Branch 2 Area")
    sec_a2 = Section.unscoped.create(
        tenant=tenant_a, branch=branch_a2, service_area=area_a2, name="Branch 2 Section"
    )
    table_a2 = DiningTable.unscoped.create(
        tenant=tenant_a, branch=branch_a2, section=sec_a2, label="B2-T1", capacity=4
    )
    mem_owner_a = Membership.objects.filter(
        tenant=tenant_a, user=venue_test_setup["owner_a"]
    ).first()
    assert mem_owner_a is not None

    mapping = {
        "/api/v1/branches/{id}/": branch_a2.id,
        "/api/v1/service-areas/{id}/": area_a2.id,
        "/api/v1/sections/{id}/": sec_a2.id,
        "/api/v1/tables/{id}/": table_a2.id,
        "/api/v1/table-sessions/{id}/": TableSession.unscoped.create(
            tenant=tenant_a, branch=branch_a2, table=table_a2
        ).id,
        "/api/v1/table-groups/{id}/": TableGroup.unscoped.create(
            tenant=tenant_a, branch=branch_a2, label="B2 Group"
        ).id,
        "/api/v1/qr-codes/{id}/": generate_qr_code(
            branch=branch_a2, target_type="TABLE", table=table_a2
        ).id,
        "/api/v1/staff-assignments/{id}/": StaffSectionAssignment.unscoped.create(
            tenant=tenant_a, branch=branch_a2, section=sec_a2, membership=mem_owner_a
        ).id,
    }

    client = make_client(user, tenant_a)
    unassigned_branch_id = mapping[resource_url_template]
    res_b2 = client.get(resource_url_template.format(id=unassigned_branch_id))
    assert res_b2.status_code == status.HTTP_404_NOT_FOUND
    assert res_b2.data["error"]["code"] == "NOT_FOUND"

    random_id = uuid.uuid4()
    res_random = client.get(resource_url_template.format(id=random_id))
    assert res_random.status_code == status.HTTP_404_NOT_FOUND
    assert res_b2.data == res_random.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "case_name",
    [
        "tables_create_foreign_section",
        "sections_create_foreign_service_area",
        "tables_bulk_create_foreign_section",
        "tables_layout_foreign_table",
        "qr_generate_foreign_branch",
        "qr_generate_foreign_table",
        "table_sessions_open_foreign_table",
        "tables_join_foreign_table",
        "tables_split_foreign_group",
        "staff_assignments_foreign_membership",
    ],
)
def test_cross_tenant_body_payloads_return_400_invalid_reference(venue_test_setup, case_name):
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

    cases = {
        "tables_create_foreign_section": (
            "/api/v1/tables/",
            {"branch": str(branch_a.id), "section": str(sec_b.id), "label": "T-F", "capacity": 4},
            {"branch": str(branch_a.id), "section": random_uuid, "label": "T-F", "capacity": 4},
        ),
        "sections_create_foreign_service_area": (
            "/api/v1/sections/",
            {"branch": str(branch_a.id), "service_area": str(area_b.id), "name": "Sec-F"},
            {"branch": str(branch_a.id), "service_area": random_uuid, "name": "Sec-F"},
        ),
        "tables_bulk_create_foreign_section": (
            "/api/v1/tables/bulk-create/",
            {"branch_id": str(branch_a.id), "section_id": str(sec_b.id), "count": 2},
            {"branch_id": str(branch_a.id), "section_id": random_uuid, "count": 2},
        ),
        "tables_layout_foreign_table": (
            "/api/v1/tables/layout/",
            {"tables": [{"id": str(table_b.id), "x": 100, "y": 200}]},
            {"tables": [{"id": random_uuid, "x": 100, "y": 200}]},
        ),
        "qr_generate_foreign_branch": (
            "/api/v1/qr-codes/generate/",
            {"branch_id": str(branch_b.id), "table_id": str(table_a.id)},
            {"branch_id": random_uuid, "table_id": str(table_a.id)},
        ),
        "qr_generate_foreign_table": (
            "/api/v1/qr-codes/generate/",
            {"branch_id": str(branch_a.id), "table_id": str(table_b.id)},
            {"branch_id": str(branch_a.id), "table_id": random_uuid},
        ),
        "table_sessions_open_foreign_table": (
            "/api/v1/table-sessions/open/",
            {"table_id": str(table_b.id), "guest_count": 2},
            {"table_id": random_uuid, "guest_count": 2},
        ),
        "tables_join_foreign_table": (
            "/api/v1/tables/join/",
            {"table_ids": [str(table_a.id), str(table_b.id)], "label": "Join"},
            {"table_ids": [str(table_a.id), random_uuid], "label": "Join"},
        ),
        "tables_split_foreign_group": (
            "/api/v1/tables/split/",
            {"group_id": str(table_b.id)},
            {"group_id": random_uuid},
        ),
        "staff_assignments_foreign_membership": (
            "/api/v1/staff-assignments/",
            {
                "branch": str(branch_a.id),
                "membership": str(membership_b.id),
                "section": str(sec_a.id),
            },
            {
                "branch": str(branch_a.id),
                "membership": random_uuid,
                "section": str(sec_a.id),
            },
        ),
    }

    url, payload_foreign, payload_random = cases[case_name]
    res_f = client_a.post(url, payload_foreign, format="json")
    res_r = client_a.post(url, payload_random, format="json")
    assert res_f.status_code == 400
    assert res_f.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_f.data == res_r.data


@pytest.mark.django_db
def test_cross_branch_body_payloads_return_400_invalid_reference(venue_test_setup):
    """Same tenant, different branch references in body return 400 INVALID_REFERENCE identical to random UUID."""
    client_a = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    branch_a1 = venue_test_setup["branch_a1"]
    branch_a2 = venue_test_setup["branch_a2"]

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
