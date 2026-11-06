import pytest

from apps.venues.models import DiningTable, Section, ServiceArea
from apps.venues.tests.conftest import make_client


@pytest.mark.django_db
def test_dining_table_list_filters_and_natural_ordering(venue_test_setup):
    """
    Test DiningTable list filters:
    area_id, section_id, branch_id, status, is_active, search, and natural ordering.
    """
    setup = venue_test_setup
    client = make_client(setup["owner_a"], setup["tenant_a"])
    branch = setup["branch_a1"]
    sec = setup["sec_a1"]
    tenant = setup["tenant_a"]

    DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="X1", label_prefix="X", label_number=1, is_active=True, status="AVAILABLE"
    )
    DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="X2", label_prefix="X", label_number=2, is_active=True, status="OCCUPIED"
    )
    DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="X10", label_prefix="X", label_number=10, is_active=False, status="AVAILABLE"
    )

    # 1. Natural ordering: X1, X2, X10
    res = client.get(f"/api/v1/tables/?branch_id={branch.id}")
    assert res.status_code == 200
    labels = [t["label"] for t in res.data["results"] if t["label"].startswith("X")]
    assert labels == ["X1", "X2", "X10"]

    # 2. Filter by status=AVAILABLE
    res_avail = client.get(f"/api/v1/tables/?branch_id={branch.id}&status=AVAILABLE")
    assert res_avail.status_code == 200
    avail_labels = [t["label"] for t in res_avail.data["results"] if t["label"].startswith("X")]
    assert "X1" in avail_labels
    assert "X10" in avail_labels
    assert "X2" not in avail_labels

    # 3. Filter by is_active=true
    res_active = client.get(f"/api/v1/tables/?branch_id={branch.id}&is_active=true")
    assert res_active.status_code == 200
    active_labels = [t["label"] for t in res_active.data["results"] if t["label"].startswith("X")]
    assert "X1" in active_labels
    assert "X2" in active_labels
    assert "X10" not in active_labels

    # 4. Filter by search=X10
    res_search = client.get(f"/api/v1/tables/?branch_id={branch.id}&search=X10")
    assert res_search.status_code == 200
    search_labels = [t["label"] for t in res_search.data["results"] if t["label"].startswith("X")]
    assert search_labels == ["X10"]

    # 5. Filter by area_id
    area_id = setup["area_a1"].id
    res_area = client.get(f"/api/v1/tables/?area_id={area_id}")
    assert res_area.status_code == 200
    area_labels = [t["label"] for t in res_area.data["results"] if t["label"].startswith("X")]
    assert "X1" in area_labels


@pytest.mark.django_db
def test_section_type_is_active_and_cannot_create_in_inactive_section(venue_test_setup):
    """
    Test section_type and is_active functionality:
    1. Filter sections by section_type (INDOOR, OUTDOOR, VIP, PRIVATE_ROOM)
    2. Filter sections by is_active
    3. Creating table in inactive section fails with 400 INACTIVE_SECTION
    """
    setup = venue_test_setup
    client = make_client(setup["owner_a"], setup["tenant_a"])
    branch = setup["branch_a1"]
    tenant = setup["tenant_a"]
    area = setup["area_a1"]

    Section.objects.create(
        tenant=tenant, branch=branch, service_area=area, name="Executive VIP", section_type="VIP", is_active=True, sort_order=1
    )
    sec_inactive = Section.objects.create(
        tenant=tenant, branch=branch, service_area=area, name="Renovation Section", section_type="INDOOR", is_active=False, sort_order=2
    )

    # Filter section by section_type=VIP
    res_vip = client.get(f"/api/v1/sections/?section_type=VIP")
    assert res_vip.status_code == 200
    names = [s["name"] for s in res_vip.data["results"]]
    assert "Executive VIP" in names
    assert "Renovation Section" not in names

    # Filter section by is_active=true
    res_act = client.get(f"/api/v1/sections/?is_active=true")
    assert res_act.status_code == 200
    act_names = [s["name"] for s in res_act.data["results"]]
    assert "Executive VIP" in act_names
    assert "Renovation Section" not in act_names

    # Table creation in inactive section must fail with 400 INACTIVE_SECTION
    res_tbl = client.post(
        "/api/v1/tables/",
        {
            "branch": str(branch.id),
            "section": str(sec_inactive.id),
            "label": "INACT-1",
            "capacity": 4,
            "min_capacity": 1,
            "table_type": "TABLE",
            "shape": "RECT",
        },
        format="json",
    )
    assert res_tbl.status_code == 400
    assert "INACTIVE_SECTION" in str(res_tbl.data) or "inactive section" in str(res_tbl.data).lower()


@pytest.mark.django_db
def test_service_area_and_section_list_filters(venue_test_setup):
    """
    Test ServiceArea and Section list filtering by branch_id and is_active.
    """
    setup = venue_test_setup
    client = make_client(setup["owner_a"], setup["tenant_a"])
    branch = setup["branch_a1"]
    tenant = setup["tenant_a"]

    ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Inactive Terrace", sort_order=10, is_active=False
    )
    Section.objects.create(
        tenant=tenant, branch=branch, service_area=setup["area_a1"], name="Outdoor Porch", sort_order=5
    )

    # Filter ServiceArea by is_active=true
    res = client.get(f"/api/v1/service-areas/?branch_id={branch.id}&is_active=true")
    assert res.status_code == 200
    names = [a["name"] for a in res.data["results"]]
    assert "Inactive Terrace" not in names
    assert setup["area_a1"].name in names

    # Filter Section by service_area_id
    res_sec = client.get(f"/api/v1/sections/?service_area_id={setup['area_a1'].id}")
    assert res_sec.status_code == 200
    sec_names = [s["name"] for s in res_sec.data["results"]]
    assert "Outdoor Porch" in sec_names


@pytest.mark.django_db
def test_staff_list_filters(venue_test_setup):
    """
    Test Staff list filters: role, is_active, branch.
    """
    setup = venue_test_setup
    client = make_client(setup["owner_a"], setup["tenant_a"])

    # Filter staff by role
    res_role = client.get("/api/v1/staff/?role=OWNER")
    assert res_role.status_code == 200
    roles = [s["role"] for s in res_role.data["results"]]
    assert all(r == "OWNER" for r in roles)

    # Filter staff by is_active=true
    res_active = client.get("/api/v1/staff/?is_active=true")
    assert res_active.status_code == 200
    assert all(s["is_active"] is True for s in res_active.data["results"])
