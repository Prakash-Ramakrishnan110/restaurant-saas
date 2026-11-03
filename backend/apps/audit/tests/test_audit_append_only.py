import pytest

from apps.audit.models import AuditLog
from apps.audit.services import log_audit_event
from apps.tenants.models import Tenant


@pytest.mark.django_db
def test_audit_log_creation():
    tenant = Tenant.objects.create(name="Audit T", slug="audit-t")
    log = log_audit_event(
        action="test.action",
        entity_type="Tenant",
        entity_id=str(tenant.id),
        tenant=tenant,
        after_state={"name": "Audit T"},
    )
    assert log.action == "test.action"
    assert log.entity_type == "Tenant"
    assert log.entity_id == str(tenant.id)
    assert log.after_state == {"name": "Audit T"}


@pytest.mark.django_db
def test_audit_log_block_model_update():
    log = AuditLog.objects.create(
        action="initial.action",
        entity_type="Test",
        entity_id="123",
    )
    log.action = "modified.action"
    with pytest.raises(PermissionError, match="strictly append-only and cannot be updated"):
        log.save()


@pytest.mark.django_db
def test_audit_log_block_model_delete():
    log = AuditLog.objects.create(
        action="initial.action",
        entity_type="Test",
        entity_id="123",
    )
    with pytest.raises(PermissionError, match="strictly append-only and cannot be deleted"):
        log.delete()


@pytest.mark.django_db
def test_audit_log_block_queryset_update():
    AuditLog.objects.create(action="a1", entity_type="T", entity_id="1")
    with pytest.raises(PermissionError, match="strictly append-only and cannot be updated"):
        AuditLog.objects.filter(entity_type="T").update(action="modified")


@pytest.mark.django_db
def test_audit_log_block_queryset_delete():
    AuditLog.objects.create(action="a1", entity_type="T", entity_id="1")
    with pytest.raises(PermissionError, match="strictly append-only and cannot be deleted"):
        AuditLog.objects.filter(entity_type="T").delete()
