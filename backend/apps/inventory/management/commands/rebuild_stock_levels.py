from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.inventory.services import rebuild_and_compare_stock_levels


class Command(BaseCommand):
    help = "Rebuild StockLevel totals from append-only StockMovement rows and compare."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write recomputed totals back to StockLevel if any mismatch is found.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        apply_fix = bool(options.get("apply", False))
        result = rebuild_and_compare_stock_levels(apply=apply_fix)
        self.stdout.write(
            f"Checked {result['checked_keys']} stock keys: {result['mismatch_count']} mismatch(es)."
        )
        if result["mismatch_count"] > 0 and not apply_fix:
            raise CommandError(
                f"StockLevel drift detected ({result['mismatch_count']} mismatches). Run with --apply to rebuild."
            )
