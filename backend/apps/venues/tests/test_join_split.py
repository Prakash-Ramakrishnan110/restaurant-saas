import pytest
from rest_framework.exceptions import ValidationError

from apps.core.context import set_current_tenant
from apps.venues.services import join_tables, split_tables


@pytest.mark.django_db
def test_join_and_split_tables(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    table1 = venue_test_setup["table_a1_1"]
    table2 = venue_test_setup["table_a1_2"]
    actor = venue_test_setup["owner_a"]

    # Join tables
    group = join_tables(
        branch=branch,
        table_ids=[table1.id, table2.id],
        label="Party of 8",
        actor=actor,
    )
    assert group.is_active is True
    table1.refresh_from_db()
    table2.refresh_from_db()
    assert table1.group == group
    assert table2.group == group

    # Split tables
    split_tables(group=group, actor=actor)
    table1.refresh_from_db()
    table2.refresh_from_db()
    assert table1.group is None
    assert table2.group is None
    group.refresh_from_db()
    assert group.is_active is False


@pytest.mark.django_db
def test_cannot_join_tables_from_different_branches(venue_test_setup):
    branch_a = venue_test_setup["branch_a1"]
    table_a = venue_test_setup["table_a1_1"]
    table_b = venue_test_setup["table_b1_1"]  # from tenant B
    actor = venue_test_setup["owner_a"]

    with pytest.raises(ValidationError):
        join_tables(
            branch=branch_a,
            table_ids=[table_a.id, table_b.id],
            actor=actor,
        )


@pytest.mark.django_db
def test_join_and_split_api(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["owner_a"], venue_test_setup["tenant_a"])
    table1 = venue_test_setup["table_a1_1"]
    table2 = venue_test_setup["table_a1_2"]

    # Join via API
    res = client.post(
        "/api/v1/tables/join/",
        {"table_ids": [str(table1.id), str(table2.id)], "label": "Group 1"},
    )
    assert res.status_code == 201
    group_id = res.data["id"]

    # Split via API
    res_split = client.post("/api/v1/tables/split/", {"group_id": group_id})
    assert res_split.status_code == 200
