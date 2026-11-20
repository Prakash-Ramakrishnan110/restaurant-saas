from celery import shared_task

from apps.inventory.services import (
    cancel_order_line_deduction,
    deduct_order_line,
    deduct_takeaway_packaging,
)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def deduct_order_line_stock_task(self, order_line_id: str) -> str:
    """Post-commit Celery task to idempotently deduct stock for an accepted/paid order line."""
    result = deduct_order_line(order_line_id)
    if result is None:
        return "SKIPPED"
    return result.status


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def deduct_takeaway_packaging_task(self, order_id: str) -> int:
    """Post-commit Celery task to deduct configured takeaway packaging items."""
    return deduct_takeaway_packaging(order_id)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def cancel_order_line_deduction_task(self, order_line_id: str, was_preparing: bool) -> str:
    """Post-commit Celery task to record CANCELLED_AFTER_COOKING waste when needed."""
    cancel_order_line_deduction(order_line_id, was_preparing=was_preparing)
    return "OK"
