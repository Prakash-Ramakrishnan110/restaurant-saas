import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.audit.models import AuditLog
from apps.audit.serializers import sanitize_audit_dict
from apps.audit.services import log_audit_event
from apps.rbac.constants import Role
from apps.tenants.models import Tenant


def _auth(user: User, tenant: Tenant | None = None) -> APIClient:
    c = APIClient()
    tok = str(RefreshToken.for_user(user).access_token)
    hdrs: dict[str, str] = {"HTTP_AUTHORIZATION": f"Bearer {tok}"}
    if tenant is not None:
        hdrs["HTTP_X_TENANT_ID"] = str(tenant.id)
    c.credentials(**hdrs)
    return c


@pytest.mark.django_db
def test_audit_log_view_permissions_filters_and_redaction() -> None:
    t1 = Tenant.objects.create(name="Audit Cafe", slug="audit-cafe")
    owner = User.objects.create_user(email="owner@audit.test", password="Password123!")
    waiter = User.objects.create_user(email="waiter@audit.test", password="Password123!")
    outsider = User.objects.create_user(email="outsider@audit.test", password="Password123!")
    padmin = User.objects.create_user(
        email="admin@audit.test", password="Password123!", is_platform_admin=True
    )
    Membership.objects.create(tenant=t1, user=owner, role=Role.OWNER, is_active=True)
    Membership.objects.create(tenant=t1, user=waiter, role=Role.WAITER, is_active=True)

    log_audit_event(
        action="staff.login",
        entity_type="User",
        entity_id=str(owner.id),
        actor=owner,
        tenant=t1,
        before_state={"nested": {"password": "old"}},
        after_state={"token": "secret123", "ok": True},
    )
    AuditLog.objects.create(
        tenant=t1,
        action="system.tick",
        entity_type="Tenant",
        entity_id=str(t1.id),
        after_state={"authorization": "Bearer abc"},
    )

    assert sanitize_audit_dict("plain") == "plain"

    # Waiter denied (403); User without tenant membership denied (403)
    assert _auth(waiter, t1).get("/api/v1/audit-logs/").status_code == 403
    assert _auth(outsider, None).get("/api/v1/audit-logs/").status_code == 403

    # Owner with filters & secret redaction check
    today_str = timezone.now().date().isoformat()
    owner_client = _auth(owner, t1)
    res_all = owner_client.get("/api/v1/audit-logs/")
    assert res_all.status_code == 200
    items = res_all.data["results"] if "results" in res_all.data else res_all.data
    assert len(items) >= 2
    login_row = next(r for r in items if r["action"] == "staff.login")
    assert login_row["after_state"]["token"] == "[REDACTED]"
    assert login_row["before_state"]["nested"]["password"] == "[REDACTED]"

    res_filt = owner_client.get(
        f"/api/v1/audit-logs/?action=staff.login&entity_type=User&actor={owner.id}&date={today_str}"
    )
    assert res_filt.status_code == 200

    # Platform admin global audit query with tenant_id filter
    admin_res = _auth(padmin).get(f"/api/v1/audit-logs/?tenant_id={t1.id}")
    assert admin_res.status_code == 200
