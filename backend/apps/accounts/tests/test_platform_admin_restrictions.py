import uuid

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.tenants.services import create_tenant_with_defaults


@pytest.fixture
def platform_admin_env():
    admin = User.objects.create_user(
        email="super_admin@platform.com",
        password="SuperPassword123!",
        full_name="Platform Admin",
        is_platform_admin=True,
        is_active=True,
    )
    tenant, owner, _ = create_tenant_with_defaults(
        name="Platform Test Bistro",
        slug="platform-test-bistro",
        owner_email="bistro_owner@example.com",
        owner_full_name="Bistro Owner",
    )
    admin_client = APIClient()
    admin_token = str(RefreshToken.for_user(admin).access_token)
    admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    return {
        "admin": admin,
        "tenant": tenant,
        "admin_client": admin_client,
    }


@pytest.mark.django_db
def test_platform_admin_denied_restaurant_orders(platform_admin_env):
    """Platform admins get 403 or 404 on restaurant order endpoints."""
    client = platform_admin_env["admin_client"]
    tenant = platform_admin_env["tenant"]

    # 1. Without tenant header
    res_no_tenant = client.get("/api/v1/orders/")
    assert res_no_tenant.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    # 2. With restaurant tenant header (platform admin is not a member)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(platform_admin_env['admin']).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    res_list = client.get("/api/v1/orders/")
    assert res_list.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    res_post = client.post("/api/v1/orders/", {"order_type": "DINE_IN"})
    assert res_post.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


@pytest.mark.django_db
def test_platform_admin_denied_restaurant_bills(platform_admin_env):
    """Platform admins get 403 or 404 on restaurant bill/invoice endpoints."""
    client = platform_admin_env["admin_client"]
    tenant = platform_admin_env["tenant"]

    # Without tenant header
    assert client.get("/api/v1/invoices/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )
    assert client.get("/api/v1/orders/billing/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )

    # With tenant header
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(platform_admin_env['admin']).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    assert client.get("/api/v1/invoices/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )
    assert client.get("/api/v1/orders/billing/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )


@pytest.mark.django_db
def test_platform_admin_denied_restaurant_customers(platform_admin_env):
    """Platform admins get 403 or 404 on restaurant customer endpoints."""
    client = platform_admin_env["admin_client"]
    tenant = platform_admin_env["tenant"]

    # Without tenant header
    assert client.get("/api/v1/customers/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )

    # With tenant header
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(platform_admin_env['admin']).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    assert client.get("/api/v1/customers/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )
    assert client.post("/api/v1/customers/", {"name": "Test Customer", "phone": "9876543210"}).status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )


@pytest.mark.django_db
def test_platform_admin_denied_restaurant_payments(platform_admin_env):
    """Platform admins get 403 or 404 on restaurant payment/settlement endpoints."""
    client = platform_admin_env["admin_client"]
    tenant = platform_admin_env["tenant"]
    fake_id = uuid.uuid4()

    # Without tenant header
    assert client.post(f"/api/v1/orders/{fake_id}/settle/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )
    assert client.post(f"/api/v1/orders/billing/{fake_id}/settle/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )

    # With tenant header
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(platform_admin_env['admin']).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    assert client.post(f"/api/v1/orders/{fake_id}/settle/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )
    assert client.post(f"/api/v1/orders/billing/{fake_id}/settle/").status_code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    )

