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


def test_celery_health_check_task():
    result = health_check_task.apply().get()
    assert result == "celery_ok"
