import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="apps.core.tasks.health_check_task")
def health_check_task() -> str:
    """Celery health-check task to verify broker and worker connectivity."""
    logger.info("Executing Celery health check task")
    return "celery_ok"


@shared_task(name="apps.core.tasks.expire_idle_sessions_task")
def expire_idle_sessions_task(timeout_minutes: int = 180) -> int:
    """Scheduled task to close abandoned table sessions with no activity after timeout threshold."""
    from apps.venues.services import expire_idle_sessions

    logger.info(f"Checking for idle table sessions exceeding {timeout_minutes}m timeout")
    closed_count = expire_idle_sessions(timeout_minutes=timeout_minutes)
    logger.info(f"Closed {closed_count} idle table sessions")
    return closed_count
