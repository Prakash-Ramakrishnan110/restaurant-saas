"""Management command to seed or update the global Master Food Catalogue."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.menu.models import FoodCatalogItem

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "master_food_catalog.json"


class Command(BaseCommand):
    help = "Seed or update global FoodCatalogItem records from master_food_catalog.json."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--path",
            type=str,
            default=str(DATA_FILE),
            help="Path to the master_food_catalog.json file.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        data_path = Path(options["path"])
        if not data_path.exists():
            self.stderr.write(self.style.ERROR(f"Catalog file not found: {data_path}"))
            return

        rows = json.loads(data_path.read_text(encoding="utf-8"))
        existing = {obj.item_code: obj for obj in FoodCatalogItem.objects.all()}

        to_create: list[FoodCatalogItem] = []
        to_update: list[FoodCatalogItem] = []

        for row in rows:
            code = str(row["item_code"])
            price_inr = row.get("default_price_inr")
            price_paise = (
                int(price_inr) * 100 if isinstance(price_inr, int) and price_inr > 0 else None
            )
            fields = {
                "name": str(row["name"])[:150],
                "name_ta": str(row.get("name_ta") or "")[:150],
                "main_category": str(row["main_category"])[:100],
                "subcategory": str(row.get("subcategory") or "")[:120],
                "cuisine": str(row.get("cuisine") or "")[:80],
                "food_type": str(row.get("food_type") or "VEG"),
                "description": str(row.get("description") or ""),
                "default_price_paise": price_paise,
                "is_bestseller": bool(row.get("is_bestseller", False)),
                "image_key": str(row.get("image_key") or "")[:64],
                "image_card": str(row.get("image_card") or "")[:500],
                "image_thumb": str(row.get("image_thumb") or "")[:500],
            }
            if code in existing:
                obj = existing[code]
                for k, v in fields.items():
                    setattr(obj, k, v)
                to_update.append(obj)
            else:
                to_create.append(FoodCatalogItem(item_code=code, **fields))

        with transaction.atomic():
            if to_create:
                FoodCatalogItem.objects.bulk_create(to_create, batch_size=500)
            if to_update:
                FoodCatalogItem.objects.bulk_update(
                    to_update,
                    fields=[
                        "name",
                        "name_ta",
                        "main_category",
                        "subcategory",
                        "cuisine",
                        "food_type",
                        "description",
                        "default_price_paise",
                        "is_bestseller",
                        "image_key",
                        "image_card",
                        "image_thumb",
                    ],
                    batch_size=500,
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded master food catalog: {len(to_create)} created, {len(to_update)} updated."
            )
        )
