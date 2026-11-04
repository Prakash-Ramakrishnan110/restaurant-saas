import pytest
from django.contrib.auth import get_user_model
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.core.middleware import is_password_change_exempt
from apps.rbac.constants import Role
from apps.tenants.models import Tenant

User = get_user_model()
FAKE_UUID = "11111111-1111-4111-8111-111111111111"


def _api_paths() -> list[str]:
    schema = SchemaGenerator().get_schema(request=None, public=True)
    paths = []
    for path in schema["paths"]:
        concrete = path
        for part in path.split("/"):
            if part.startswith("{"):
                concrete = concrete.replace(part, FAKE_UUID if "token" not in part else "tok")
        paths.append(concrete)
    return sorted(paths)


def _client_for(user, tenant=None):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    if tenant is not None:
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}",
            HTTP_X_TENANT_ID=str(tenant.id),
        )
    return client


@pytest.fixture
def gated_users():
    tenant = Tenant.objects.create(name="Gate Co", slug="gate-co", status=Tenant.Status.ACTIVE)
    owner = User.objects.create_user(
        email="o@gate.com", password="Password123!", full_name="O", must_change_password=True
    )
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)
    admin = User.objects.create_user(
        email="admin@gate.com",
        password="Password123!",
        full_name="A",
        is_platform_admin=True,
        must_change_password=True,
    )
    return tenant, owner, admin


@pytest.mark.django_db
@pytest.mark.parametrize("who", ["owner", "platform_admin"])
def test_every_api_route_is_gated_while_password_change_required(gated_users, who):
    tenant, owner, admin = gated_users
    user = owner if who == "owner" else admin
    client = _client_for(user, tenant)
    paths = [p for p in _api_paths() if not is_password_change_exempt(p)]
    assert len(paths) >= 40, f"route sweep found suspiciously few routes: {len(paths)}"
    for path in paths:
        if path.startswith("/api/v1/public/"):
            continue  # anonymous diner endpoints; no authenticated user involved
        for method in ("get", "post"):
            res = getattr(client, method)(path, {}, format="json")
            assert res.status_code == 403, f"{method.upper()} {path} -> {res.status_code}"
            assert res.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED", path


@pytest.mark.django_db
def test_gate_exempt_routes_still_work(gated_users):
    tenant, owner, _ = gated_users
    client = _client_for(owner, tenant)
    assert client.get("/api/v1/auth/me/").status_code == 200
    assert client.get("/health").status_code == 200
    assert client.get("/health/").status_code == 200
    assert client.get("/api/schema/").status_code == 200
    out = client.post("/api/v1/auth/logout/")
    assert out.status_code == 204


@pytest.mark.django_db
def test_exempt_path_helper():
    assert is_password_change_exempt("/api/v1/auth/me/")
    assert is_password_change_exempt("/api/v1/auth/change-password")
    assert is_password_change_exempt("/api/docs/")
    assert not is_password_change_exempt("/api/v1/tenants/")
    assert not is_password_change_exempt("/api/v1/venues/presets/")
    assert not is_password_change_exempt("/api/v1/auth/me/../tenants/")
