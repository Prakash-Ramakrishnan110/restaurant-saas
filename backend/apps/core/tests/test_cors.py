import pytest
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_cors_preflight_allows_localhost_5173_with_credentials():
    client = APIClient()
    response = client.options(
        "/api/v1/auth/login/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,x-tenant-id",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"


@pytest.mark.django_db
def test_cors_get_request_allows_localhost_5173_with_credentials():
    client = APIClient()
    response = client.get(
        "/health",
        HTTP_ORIGIN="http://localhost:5173",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
