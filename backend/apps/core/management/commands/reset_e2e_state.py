"""Test/dev-only management command to reset ephemeral E2E table/session state."""

from __future__ import annotations

import os
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    """Reset open table sessions and table statuses for repeatable E2E runs."""

    help = "Close open table sessions and mark dining tables AVAILABLE (DEBUG/TEST only)."

    def handle(self, *args: Any, **options: Any) -> None:
        is_debug = bool(getattr(settings, "DEBUG", False))
        is_testing = bool(getattr(settings, "TESTING", False))
        is_test_env = os.environ.get("TEST", "").lower() in ("1", "true", "yes")
        settings_mod = os.environ.get("DJANGO_SETTINGS_MODULE", "").lower()
        if not (is_debug or is_testing or is_test_env or "test" in settings_mod):
            raise CommandError("reset_e2e_state may only run when DEBUG or TEST is enabled.")

        from django.core.cache import cache

        from apps.orders.models import Order
        from apps.venues.models import DiningTable, TableSession

        cache.clear()
        cancelled_qr = (
            Order.unscoped.filter(source="QR")
            .exclude(status__in=["BILLED", "COMPLETED", "CANCELLED", "SERVED"])
            .update(status="CANCELLED")
        )
        closed_count = TableSession.unscoped.filter(status="OPEN").update(status="CLOSED")
        tables_reset = DiningTable.unscoped.exclude(status="AVAILABLE").update(status="AVAILABLE")
        self.stdout.write(
            self.style.SUCCESS(
                f"E2E reset complete: cancelled_qr={cancelled_qr}, closed_sessions={closed_count}, tables_reset={tables_reset}"
            )
        )
