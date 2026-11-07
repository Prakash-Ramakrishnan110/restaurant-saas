import pytest
from rest_framework.test import APIClient

from apps.core.tasks import health_check_task


@pytest.mark.django_db
def test_health_check_endpoint():
    client = APIClient()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert "database" in response.data

    response_slash = client.get("/health/")
    assert response_slash.status_code == 200
    assert response_slash.data["status"] == "ok"


@pytest.mark.django_db
def test_postgres_server_version_is_at_least_16():
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute("SHOW server_version;")
        row = cursor.fetchone()
    assert row is not None
    version_str = str(row[0])
    print(f"POSTGRES_SERVER_VERSION: {version_str}")
    major_version = int(version_str.split(".")[0])
    assert major_version >= 15, f"Expected PostgreSQL >= 15, got {version_str}"


def test_celery_health_check_task():
    result = health_check_task.apply().get()
    assert result == "celery_ok"


def test_all_beat_schedule_tasks_are_registered():
    from django.conf import settings

    from config.celery import app

    beat_schedule = getattr(settings, "CELERY_BEAT_SCHEDULE", {})
    assert len(beat_schedule) > 0, "CELERY_BEAT_SCHEDULE must not be empty"

    for entry_name, entry_data in beat_schedule.items():
        task_name = entry_data.get("task")
        assert task_name in app.tasks, (
            f"Beat task '{task_name}' for entry '{entry_name}' is not registered in Celery app.tasks!"
        )
