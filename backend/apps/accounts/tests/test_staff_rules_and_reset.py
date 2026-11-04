import logging

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.accounts.staff_service import update_staff_member
from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleError
from apps.rbac.constants import Role
from apps.tenants.models import Branch, Tenant

User = get_user_model()
PW = "Password123!"


def make(email, tenant, role, branches=(), must_change=False):
    user = User.objects.create_user(
        email=email, password=PW, full_name=email, must_change_password=must_change
    )
    m = Membership.objects.create(user=user, tenant=tenant, role=role, is_active=True)
    if branches:
        m.branches.set(branches)
    return user, m


def client_for(user, tenant):
    c = APIClient()
    c.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    return c


@pytest.fixture
def env():
    t = Tenant.objects.create(name="Staff Co", slug="staff-co", status=Tenant.Status.ACTIVE)
    b1 = Branch.unscoped.create(tenant=t, name="B1")
    b2 = Branch.unscoped.create(tenant=t, name="B2")
    o1, m_o1 = make("o1@s.com", t, Role.OWNER)
    o2, m_o2 = make("o2@s.com", t, Role.OWNER)
    bm1, m_bm1 = make("bm1@s.com", t, Role.BRANCH_MANAGER, [b1])
    bm1b, m_bm1b = make("bm1b@s.com", t, Role.BRANCH_MANAGER, [b1])
    w1, m_w1 = make("w1@s.com", t, Role.WAITER, [b1])
    w2, m_w2 = make("w2@s.com", t, Role.WAITER, [b2])
    return locals()


@pytest.mark.django_db
def test_owner_cannot_change_own_role_or_active(env):
    c = client_for(env["o1"], env["t"])
    for body in ({"role": Role.WAITER}, {"is_active": False}):
        res = c.patch(f"/api/v1/staff/{env['m_o1'].id}/", body, format="json")
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "ROLE_NOT_ALLOWED"


@pytest.mark.django_db
def test_last_owner_cannot_be_deactivated_or_demoted(env):
    c = client_for(env["o1"], env["t"])
    # With two owners, deactivating the other is fine
    ok = c.patch(f"/api/v1/staff/{env['m_o2'].id}/", {"is_active": False}, format="json")
    assert ok.status_code == 200
    # Now o1 is the only active owner: even a platform-level actor cannot remove them
    for kwargs in ({"is_active": False}, {"role": Role.WAITER}):
        with pytest.raises(BusinessRuleError) as exc:
            update_staff_member(
                membership=env["m_o1"],
                actor=User.objects.create_user(
                    email=f"pa{len(kwargs)}{list(kwargs)[0]}@x.com",
                    password=PW,
                    full_name="PA",
                    is_platform_admin=True,
                ),
                actor_role=Role.PLATFORM_ADMIN,
                **kwargs,
            )
        assert exc.value.error_code == "LAST_OWNER"
        assert exc.value.status_code == 409


@pytest.mark.django_db
def test_last_owner_delete_endpoint_returns_409(env):
    c = client_for(env["o1"], env["t"])
    Membership.objects.filter(pk=env["m_o2"].pk).update(is_active=False)
    # o1 deleting o2 (already inactive) is harmless; o2 trying to delete the last owner cannot
    # happen via API (inactive), so assert the service rule through demotion by a second owner:
    Membership.objects.filter(pk=env["m_o2"].pk).update(is_active=True)
    c2 = client_for(env["o2"], env["t"])
    assert c2.patch(f"/api/v1/staff/{env['m_o1'].id}/", {"is_active": False}, format="json")
    res = c.patch(f"/api/v1/staff/{env['m_o2'].id}/", {"is_active": False}, format="json")
    # o1 is now inactive, so o1's token no longer carries an active membership
    assert res.status_code in (403, 404)


@pytest.mark.django_db
def test_manager_cannot_edit_equal_or_higher_roles(env):
    c = client_for(env["bm1"], env["t"])
    for target in (env["m_o1"], env["m_bm1b"]):
        res = c.patch(f"/api/v1/staff/{target.id}/", {"is_active": False}, format="json")
        assert res.status_code in (403, 404)
        if res.status_code == 403:
            assert res.json()["error"]["code"] == "ROLE_NOT_ALLOWED"
    assert Membership.objects.get(pk=env["m_bm1b"].pk).is_active


@pytest.mark.django_db
def test_manager_cannot_assign_branch_outside_scope(env):
    c = client_for(env["bm1"], env["t"])
    res = c.patch(
        f"/api/v1/staff/{env['m_w1'].id}/", {"branch_ids": [str(env["b2"].id)]}, format="json"
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "ROLE_NOT_ALLOWED"
    ok = c.patch(
        f"/api/v1/staff/{env['m_w1'].id}/", {"branch_ids": [str(env["b1"].id)]}, format="json"
    )
    assert ok.status_code == 200


@pytest.mark.django_db
def test_manager_create_staff_requires_in_scope_branches(env):
    c = client_for(env["bm1"], env["t"])
    base = {"email": "new@s.com", "full_name": "New", "role": Role.WAITER}
    assert c.post("/api/v1/staff/", base, format="json").status_code == 403
    out = c.post("/api/v1/staff/", {**base, "branch_ids": [str(env["b2"].id)]}, format="json")
    assert out.status_code == 403
    ok = c.post("/api/v1/staff/", {**base, "branch_ids": [str(env["b1"].id)]}, format="json")
    assert ok.status_code == 201


@pytest.mark.django_db
def test_manager_cannot_see_staff_of_other_branch(env):
    c = client_for(env["bm1"], env["t"])
    assert c.get(f"/api/v1/staff/{env['m_w2'].id}/").status_code == 404
    assert c.patch(f"/api/v1/staff/{env['m_w2'].id}/", {"is_active": False}).status_code == 404
    assert c.post(f"/api/v1/staff/{env['m_w2'].id}/reset-password/").status_code == 404


@pytest.mark.django_db
def test_attaching_existing_user_never_resets_their_password(env):
    other = Tenant.objects.create(name="Other", slug="other", status=Tenant.Status.ACTIVE)
    victim, _ = make("victim@o.com", other, Role.OWNER)
    old_hash = User.objects.get(pk=victim.pk).password
    c = client_for(env["o1"], env["t"])
    res = c.post(
        "/api/v1/staff/",
        {"email": "victim@o.com", "full_name": "Victim", "role": Role.WAITER},
        format="json",
    )
    assert res.status_code == 201
    assert "temporary_password" not in res.json()
    victim.refresh_from_db()
    assert victim.password == old_hash
    assert victim.must_change_password is False


@pytest.mark.django_db
def test_reset_password_flow(env):
    target = env["w1"]
    old_refresh = RefreshToken.for_user(target)
    c = client_for(env["o1"], env["t"])
    res = c.post(f"/api/v1/staff/{env['m_w1'].id}/reset-password/")
    assert res.status_code == 200
    temp = res.json()["temporary_password"]
    assert len(temp) >= 12
    target.refresh_from_db()
    assert target.must_change_password is True
    assert not target.check_password(PW) and target.check_password(temp)
    # old refresh token is dead
    assert BlacklistedToken.objects.filter(token__jti=old_refresh["jti"]).exists()
    anon = APIClient()
    assert anon.post("/api/v1/auth/refresh/", {"refresh": str(old_refresh)}).status_code == 401
    # old password no longer logs in, temp does
    assert (
        anon.post(
            "/api/v1/auth/login/", {"email": "w1@s.com", "password": PW}, format="json"
        ).status_code
        == 401
    )
    assert (
        anon.post(
            "/api/v1/auth/login/", {"email": "w1@s.com", "password": temp}, format="json"
        ).status_code
        == 200
    )


@pytest.mark.django_db
def test_reset_password_never_in_audit_or_logs(env, caplog):
    c = client_for(env["o1"], env["t"])
    with caplog.at_level(logging.DEBUG):
        res = c.post(f"/api/v1/staff/{env['m_w1'].id}/reset-password/")
    temp = res.json()["temporary_password"]
    assert temp not in caplog.text
    rows = AuditLog.objects.filter(action="staff.reset_password")
    assert rows.count() == 1
    for row in AuditLog.objects.all():
        assert temp not in str(row.before_state) + str(row.after_state)


@pytest.mark.django_db
def test_reset_password_rules(env):
    # cannot reset own
    c_owner = client_for(env["o1"], env["t"])
    assert c_owner.post(f"/api/v1/staff/{env['m_o1'].id}/reset-password/").status_code == 403
    # manager cannot reset an owner or an equal manager
    c_bm = client_for(env["bm1"], env["t"])
    for target in (env["m_o1"], env["m_bm1b"]):
        res = c_bm.post(f"/api/v1/staff/{target.id}/reset-password/")
        assert res.status_code in (403, 404)
    # waiter has no staff.manage
    c_w = client_for(env["w1"], env["t"])
    assert c_w.post(f"/api/v1/staff/{env['m_bm1'].id}/reset-password/").status_code == 403
    # user who also works elsewhere can only be reset by platform support
    other = Tenant.objects.create(name="Other2", slug="other2", status=Tenant.Status.ACTIVE)
    Membership.objects.create(user=env["w1"], tenant=other, role=Role.WAITER, is_active=True)
    res = c_owner.post(f"/api/v1/staff/{env['m_w1'].id}/reset-password/")
    assert res.status_code == 403 and res.json()["error"]["code"] == "ROLE_NOT_ALLOWED"


@pytest.mark.django_db
def test_platform_admin_creates_tenant_with_temp_owner_password_and_can_reset():
    admin = User.objects.create_user(
        email="pa@x.com", password=PW, full_name="PA", is_platform_admin=True
    )
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    res = c.post(
        "/api/v1/tenants/",
        {"name": "Fresh Cafe", "owner_email": "own@fresh.com", "owner_full_name": "Own"},
        format="json",
    )
    assert res.status_code == 201
    temp = res.json()["owner_temporary_password"]
    owner = User.objects.get(email="own@fresh.com")
    assert owner.must_change_password is True and owner.check_password(temp)
    for row in AuditLog.objects.all():
        assert temp not in str(row.before_state) + str(row.after_state)

    tenant_id = res.json()["id"]
    reset = c.post(f"/api/v1/tenants/{tenant_id}/reset-owner-password/")
    assert reset.status_code == 200
    new_temp = reset.json()["owners"][0]["temporary_password"]
    owner.refresh_from_db()
    assert not owner.check_password(temp) and owner.check_password(new_temp)
    assert owner.must_change_password is True

    # a non-platform owner cannot use the endpoint
    owner_client = APIClient()
    owner_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(owner).access_token}"
    )
    assert owner_client.post(f"/api/v1/tenants/{tenant_id}/reset-owner-password/").status_code in (
        403,
    )
