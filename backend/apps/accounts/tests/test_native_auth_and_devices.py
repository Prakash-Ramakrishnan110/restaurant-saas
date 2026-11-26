import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Membership, StaffDevice, User
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant


@pytest.fixture
def native_env(db: Any) -> dict[str, Any]:
    cache.clear()
    plan = Plan.objects.create(name="Pro", slug="native-pro", entitlements={"max_tables": 50})
    t_a = Tenant.objects.create(name="Kaveri Dining", slug="kaveri-native")
    BusinessSettings.unscoped.create(tenant=t_a)
    Subscription.objects.create(tenant=t_a, plan=plan, status=SubscriptionStatus.ACTIVE)
    b_a = Branch.unscoped.create(tenant=t_a, name="Main")

    t_b = Tenant.objects.create(name="Other Hotel", slug="other-native")
    BusinessSettings.unscoped.create(tenant=t_b)
    Subscription.objects.create(tenant=t_b, plan=plan, status=SubscriptionStatus.ACTIVE)
    Branch.unscoped.create(tenant=t_b, name="Main B")

    owner = User.objects.create_user(
        email="owner@kaveri.test", full_name="Owner", password="Pass123!@#"
    )
    Membership.objects.create(user=owner, tenant=t_a, role=Role.OWNER, is_active=True)

    waiter = User.objects.create_user(
        email="waiter@kaveri.test", full_name="Waiter", password="Pass123!@#"
    )
    m_waiter = Membership.objects.create(user=waiter, tenant=t_a, role=Role.WAITER, is_active=True)
    m_waiter.branches.add(b_a)

    admin = User.objects.create_user(
        email="padmin@kaveri.test",
        full_name="Platform Admin",
        password="Pass123!@#",
        is_platform_admin=True,
    )

    owner_b = User.objects.create_user(
        email="owner@other.test", full_name="Owner B", password="Pass123!@#"
    )
    Membership.objects.create(user=owner_b, tenant=t_b, role=Role.OWNER, is_active=True)

    return {
        "t_a": t_a,
        "t_b": t_b,
        "b_a": b_a,
        "owner": owner,
        "waiter": waiter,
        "m_waiter": m_waiter,
        "admin": admin,
        "owner_b": owner_b,
    }


@pytest.mark.django_db
def test_native_login_refresh_reuse_logout_and_no_cookies(native_env: dict[str, Any]) -> None:
    client = APIClient()

    # Missing X-Client header -> 401 generic
    r_bad_hdr = client.post(
        "/api/v1/auth/native/login/",
        {"email": "waiter@kaveri.test", "password": "Pass123!@#", "device_id": "dev-1"},
        format="json",
    )
    assert r_bad_hdr.status_code == 401

    # Platform admin refused with generic message
    r_admin = client.post(
        "/api/v1/auth/native/login/",
        {"email": "padmin@kaveri.test", "password": "Pass123!@#", "device_id": "dev-admin"},
        format="json",
        HTTP_X_CLIENT="android-staff",
    )
    assert r_admin.status_code == 401
    assert "Invalid email or password" in str(r_admin.json())

    # Role allow-list refusal
    with override_settings(NATIVE_ALLOWED_ROLES=[Role.OWNER]):
        r_disallowed = client.post(
            "/api/v1/auth/native/login/",
            {"email": "waiter@kaveri.test", "password": "Pass123!@#", "device_id": "dev-1"},
            format="json",
            HTTP_X_CLIENT="android-staff",
        )
        assert r_disallowed.status_code == 401

    # Waiter login succeeds with JSON tokens and ZERO cookies
    r_ok = client.post(
        "/api/v1/auth/native/login/",
        {
            "email": "waiter@kaveri.test",
            "password": "Pass123!@#",
            "device_id": "dev-waiter-001",
            "app_version": "1.10.0",
            "device_name": "Pixel 7",
        },
        format="json",
        HTTP_X_CLIENT="android-staff",
    )
    assert r_ok.status_code == 200
    assert not r_ok.cookies
    body = r_ok.json()
    assert body["access"]
    assert body["refresh"]
    old_refresh = body["refresh"]

    # Refresh rotates token and sets no cookies
    r_ref = client.post("/api/v1/auth/native/refresh/", {"refresh": old_refresh}, format="json")
    assert r_ref.status_code == 200
    assert not r_ref.cookies
    new_refresh = r_ref.json()["refresh"]
    assert new_refresh != old_refresh

    # Reusing blacklisted old_refresh revokes every device of that user
    r_reuse = client.post("/api/v1/auth/native/refresh/", {"refresh": old_refresh}, format="json")
    assert r_reuse.status_code == 401
    dev = StaffDevice.objects.get(user=native_env["waiter"], device_id="dev-waiter-001")
    assert dev.revoked_at is not None

    # Re-login and test logout clears push token
    r_ok2 = client.post(
        "/api/v1/auth/native/login/",
        {"email": "waiter@kaveri.test", "password": "Pass123!@#", "device_id": "dev-waiter-001"},
        format="json",
        HTTP_X_CLIENT="android-staff",
    )
    assert r_ok2.status_code == 200
    access2 = r_ok2.json()["access"]
    refresh2 = r_ok2.json()["refresh"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access2}")
    r_put = client.put(
        "/api/v1/devices/me/",
        {"device_id": "dev-waiter-001", "push_token": "fcm-secret-token", "device_name": "Moto G"},
        format="json",
    )
    assert r_put.status_code == 200
    assert "push_token" not in r_put.json()

    r_out = client.post(
        "/api/v1/auth/native/logout/",
        {"refresh": refresh2, "device_id": "dev-waiter-001"},
        format="json",
    )
    assert r_out.status_code == 200
    dev.refresh_from_db()
    assert dev.push_token is None


@pytest.mark.django_db
def test_device_management_isolation_deactivation_and_android_config(
    native_env: dict[str, Any],
) -> None:
    client = APIClient()
    r_ok = client.post(
        "/api/v1/auth/native/login/",
        {"email": "waiter@kaveri.test", "password": "Pass123!@#", "device_id": "dev-w2"},
        format="json",
        HTTP_X_CLIENT="android-staff",
    )
    assert r_ok.status_code == 200
    dev = StaffDevice.objects.get(user=native_env["waiter"], device_id="dev-w2")

    # Waiter cannot list branch devices (403)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {r_ok.json()['access']}")
    r_w_list = client.get("/api/v1/devices/", HTTP_X_TENANT_ID=str(native_env["t_a"].id))
    assert r_w_list.status_code == 403

    # Owner B cannot see or revoke Tenant A's device (404 isolation)
    from rest_framework_simplejwt.tokens import RefreshToken

    tok_b = str(RefreshToken.for_user(native_env["owner_b"]).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok_b}")
    r_iso_revoke = client.post(
        f"/api/v1/devices/{dev.id}/revoke/",
        {"reason": "Lost"},
        format="json",
        HTTP_X_TENANT_ID=str(native_env["t_b"].id),
    )
    assert r_iso_revoke.status_code == 404

    # Owner A lists and revokes Tenant A's device
    tok_a = str(RefreshToken.for_user(native_env["owner"]).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok_a}")
    r_list = client.get("/api/v1/devices/", HTTP_X_TENANT_ID=str(native_env["t_a"].id))
    assert r_list.status_code == 200
    assert len(r_list.json()) == 1
    assert "push_token" not in r_list.json()[0]

    r_rev = client.post(
        f"/api/v1/devices/{dev.id}/revoke/",
        {"reason": "Lost phone"},
        format="json",
        HTTP_X_TENANT_ID=str(native_env["t_a"].id),
    )
    assert r_rev.status_code == 200
    dev.refresh_from_db()
    assert dev.revoked_at is not None

    # Public android-config endpoint returns no-store & expected keys
    anon = APIClient()
    r_cfg = anon.get("/api/v1/app/android-config/")
    assert r_cfg.status_code == 200
    assert r_cfg.headers.get("Cache-Control") == "no-store"
    assert set(r_cfg.json().keys()) == {
        "minimum_version_code",
        "latest_version_code",
        "download_url",
        "maintenance_message",
    }


def test_android_manifest_and_tracked_secrets_scan() -> None:
    repo_root = Path(__file__).resolve().parents[4]
    manifest = repo_root / "mobile" / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    assert manifest.exists()
    tree = ET.parse(manifest)
    root = tree.getroot()
    ns = {"android": "http://schemas.android.com/apk/res/android"}

    app_el = root.find("application")
    assert app_el is not None
    assert app_el.attrib.get(f"{{{ns['android']}}}allowBackup") == "false"
    assert app_el.attrib.get(f"{{{ns['android']}}}usesCleartextTraffic") == "false"

    allowed_perms = {
        "android.permission.INTERNET",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
        "android.permission.WAKE_LOCK",
    }
    tools_ns = "{http://schemas.android.com/tools}"
    for perm in root.findall("uses-permission"):
        if perm.attrib.get(f"{tools_ns}node") == "remove":
            continue
        name = perm.attrib.get(f"{{{ns['android']}}}name")
        assert name in allowed_perms, f"Disallowed Android permission: {name}"

    # Scan tracked files for accidental private keys or Firebase service accounts
    tracked = subprocess.check_output(["git", "ls-files"], cwd=repo_root, text=True).splitlines()
    for rel in tracked:
        if rel.endswith(("google-services.json", ".jks", ".keystore")):
            raise AssertionError(f"Secret file must not be tracked: {rel}")
        p = repo_root / rel
        if p.is_file() and p.suffix in {".json", ".py", ".ts", ".tsx", ".gradle", ".xml", ".ps1"}:
            if "tests/" in rel or rel.endswith(".test.tsx"):
                continue
            txt = p.read_text(encoding="utf-8", errors="ignore")
            assert "-----BEGIN PRIVATE KEY-----" not in txt, f"Private key found in {rel}"
            assert not re.search(r'"type"\s*:\s*"service_account"', txt), (
                f"Service account in {rel}"
            )
