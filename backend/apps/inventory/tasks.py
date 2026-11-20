from contextvars import Token
from typing import Any

from celery import shared_task

from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.inventory.services import (
    cancel_order_line_deduction,
    deduct_order_line,
    deduct_takeaway_packaging,
)


def _with_tenant_context(tenant_id: str | None) -> Token[Any] | None:
    if tenant_id and get_current_tenant() is None:
        from apps.tenants.models import Tenant

        tenant = Tenant.objects.filter(pk=tenant_id).first()
        if tenant is not None:
            return set_current_tenant(tenant)
    return None


def _reset_context(token: Token[Any] | None) -> None:
    if token is not None:
        reset_current_tenant(token)
    try:
        from celery._state import _set_task_join_will_block

        _set_task_join_will_block(False)
    except Exception:
        pass


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def deduct_order_line_stock_task(self, order_line_id: str, tenant_id: str | None = None) -> str:
    """Post-commit Celery task to idempotently deduct stock for an accepted/paid order line."""
    token = _with_tenant_context(tenant_id)
    try:
        result = deduct_order_line(order_line_id)
        if result is None:
            return "SKIPPED"
        return result.status
    finally:
        _reset_context(token)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def deduct_takeaway_packaging_task(self, order_id: str, tenant_id: str | None = None) -> int:
    """Post-commit Celery task to deduct configured takeaway packaging items."""
    token = _with_tenant_context(tenant_id)
    try:
        return deduct_takeaway_packaging(order_id)
    finally:
        _reset_context(token)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def cancel_order_line_deduction_task(
    self, order_line_id: str, was_preparing: bool, tenant_id: str | None = None
) -> str:
    """Post-commit Celery task to record CANCELLED_AFTER_COOKING waste when needed."""
    token = _with_tenant_context(tenant_id)
    try:
        cancel_order_line_deduction(order_line_id, was_preparing=was_preparing)
        return "OK"
    finally:
        _reset_context(token)
