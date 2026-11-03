from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.context import set_current_tenant
from apps.venues.constants import OpenedVia, SessionStatus, TableStatus
from apps.venues.models import TableSession
from apps.venues.services import close_session, expire_idle_sessions, open_session, touch_session


@pytest.mark.django_db
def test_open_and_close_session_lifecycle(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]
    actor = venue_test_setup["owner_a"]

    # Open session
    session = open_session(
        branch=branch,
        table=table,
        opened_via=OpenedVia.STAFF,
        guest_count=2,
        actor=actor,
    )
    assert session.status == SessionStatus.OPEN
    assert session.session_code is not None
    table.refresh_from_db()
    assert table.status == TableStatus.OCCUPIED

    # Attempting to open another session on the same occupied table fails
    with pytest.raises(ValidationError):
        open_session(
            branch=branch,
            table=table,
            opened_via=OpenedVia.STAFF,
            guest_count=3,
            actor=actor,
        )

    # Touch session
    old_activity = session.last_activity_at
    touch_session(session)
    session.refresh_from_db()
    assert session.last_activity_at >= old_activity

    # Close session
    closed = close_session(session, actor=actor)
    assert closed.status == SessionStatus.CLOSED
    assert closed.closed_at is not None
    table.refresh_from_db()
    assert table.status == TableStatus.CLEANING


@pytest.mark.django_db
def test_expire_idle_sessions(venue_test_setup):
    set_current_tenant(venue_test_setup["tenant_a"])
    branch = venue_test_setup["branch_a1"]
    table = venue_test_setup["table_a1_1"]

    session = open_session(branch=branch, table=table)

    # Set last_activity_at to 4 hours ago
    past_time = timezone.now() - timedelta(hours=4)
    TableSession.objects.filter(id=session.id).update(last_activity_at=past_time)

    closed_count = expire_idle_sessions(timeout_minutes=180)
    assert closed_count == 1

    session.refresh_from_db()
    assert session.status == SessionStatus.CLOSED


@pytest.mark.django_db
def test_session_api_endpoints(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    client = make_client(venue_test_setup["waiter_a1"], venue_test_setup["tenant_a"])
    table = venue_test_setup["table_a1_1"]

    # Open session via API
    res = client.post(
        "/api/v1/table-sessions/open/",
        {"table_id": str(table.id), "guest_count": 4},
    )
    assert res.status_code == 201
    session_id = res.data["id"]

    # Close session via API
    res_close = client.post(f"/api/v1/table-sessions/{session_id}/close/")
    assert res_close.status_code == 200
    assert res_close.data["status"] == SessionStatus.CLOSED
