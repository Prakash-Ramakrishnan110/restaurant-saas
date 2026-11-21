import hashlib
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _forwards_migrate_menu_tools(apps, schema_editor):
    MenuItem = apps.get_model("menu", "MenuItem")
    MenuCategory = apps.get_model("menu", "MenuCategory")
    ItemVariant = apps.get_model("menu", "ItemVariant")
    OptionGroup = apps.get_model("menu", "OptionGroup")
    Option = apps.get_model("menu", "Option")
    ItemImage = apps.get_model("menu", "ItemImage")
    MenuTranslation = apps.get_model("menu", "MenuTranslation")

    def _hash(val: str) -> str:
        return hashlib.sha256((val or "").encode("utf-8")).hexdigest()

    # 1. Migrate existing single MenuItem image fields into ItemImage gallery
    for item in MenuItem.objects.all():
        if item.image_original or item.image_card or item.image_thumb:
            ItemImage.objects.create(
                id=uuid.uuid4(),
                tenant_id=item.tenant_id,
                item_id=item.id,
                position=0,
                is_primary=True,
                image_original=item.image_original or item.image_card or item.image_thumb,
                image_card=item.image_card or item.image_original or item.image_thumb,
                image_thumb=item.image_thumb or item.image_card or item.image_original,
                image_bytes=item.image_bytes or 0,
                focus_x=item.image_focus_x,
                focus_y=item.image_focus_y,
            )

        if item.name_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=item.tenant_id,
                entity_type="ITEM",
                entity_id=item.id,
                language="ta",
                field="name",
                defaults={
                    "text": item.name_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(item.name),
                },
            )
        if item.description_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=item.tenant_id,
                entity_type="ITEM",
                entity_id=item.id,
                language="ta",
                field="description",
                defaults={
                    "text": item.description_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(item.description),
                },
            )

    for cat in MenuCategory.objects.all():
        if cat.name_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=cat.tenant_id,
                entity_type="CATEGORY",
                entity_id=cat.id,
                language="ta",
                field="name",
                defaults={
                    "text": cat.name_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(cat.name),
                },
            )

    for var in ItemVariant.objects.select_related("item").all():
        if var.name_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=var.item.tenant_id,
                entity_type="VARIANT",
                entity_id=var.id,
                language="ta",
                field="name",
                defaults={
                    "text": var.name_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(var.name),
                },
            )

    for grp in OptionGroup.objects.all():
        if grp.name_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=grp.tenant_id,
                entity_type="OPTION_GROUP",
                entity_id=grp.id,
                language="ta",
                field="name",
                defaults={
                    "text": grp.name_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(grp.name),
                },
            )

    for opt in Option.objects.select_related("group").all():
        if opt.name_ta:
            MenuTranslation.objects.get_or_create(
                tenant_id=opt.group.tenant_id,
                entity_type="OPTION",
                entity_id=opt.id,
                language="ta",
                field="name",
                defaults={
                    "text": opt.name_ta,
                    "status": "PUBLISHED",
                    "source": "MANUAL",
                    "source_hash": _hash(opt.name),
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ("menu", "0001_initial"),
        ("tenants", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="menuitem",
            name="allergen_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="menuitem",
            name="ingredients_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.CreateModel(
            name="ItemImage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("position", models.PositiveIntegerField(default=0)),
                ("is_primary", models.BooleanField(default=False)),
                ("image_original", models.CharField(max_length=500)),
                ("image_card", models.CharField(max_length=500)),
                ("image_thumb", models.CharField(max_length=500)),
                ("image_bytes", models.PositiveIntegerField(default=0)),
                ("focus_x", models.FloatField(default=0.5)),
                ("focus_y", models.FloatField(default=0.5)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gallery_images",
                        to="menu.menuitem",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="menu_item_images",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "menu_item_images",
                "ordering": ["-is_primary", "position", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="MenuTranslation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "entity_type",
                    models.CharField(
                        choices=[
                            ("CATEGORY", "Category"),
                            ("ITEM", "Menu Item"),
                            ("VARIANT", "Variant"),
                            ("OPTION_GROUP", "Option Group"),
                            ("OPTION", "Option"),
                        ],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("entity_id", models.UUIDField(db_index=True)),
                ("language", models.CharField(db_index=True, max_length=16)),
                ("field", models.CharField(max_length=32)),
                ("text", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("MISSING", "Missing"),
                            ("DRAFT", "Draft"),
                            ("OUTDATED", "Outdated"),
                            ("REVIEWED", "Reviewed"),
                            ("PUBLISHED", "Published"),
                        ],
                        db_index=True,
                        default="DRAFT",
                        max_length=20,
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        choices=[("MANUAL", "Manual"), ("MACHINE", "Machine")],
                        default="MANUAL",
                        max_length=20,
                    ),
                ),
                ("source_hash", models.CharField(blank=True, default="", max_length=64)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_menu_translations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="menu_translations",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "menu_translations",
                "ordering": ["entity_type", "field"],
            },
        ),
        migrations.CreateModel(
            name="UnassignedPhoto",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("original_filename", models.CharField(max_length=255)),
                ("file_sha256", models.CharField(db_index=True, max_length=64)),
                ("image_original", models.CharField(max_length=500)),
                ("image_card", models.CharField(max_length=500)),
                ("image_thumb", models.CharField(max_length=500)),
                ("image_bytes", models.PositiveIntegerField(default=0)),
                ("match_score", models.FloatField(default=0.0)),
                (
                    "match_tier",
                    models.CharField(
                        choices=[("LIKELY", "Likely"), ("CHECK", "Check"), ("NO_MATCH", "No match")],
                        default="NO_MATCH",
                        max_length=20,
                    ),
                ),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "proposed_item",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="proposed_photos",
                        to="menu.menuitem",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="unassigned_menu_photos",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "menu_unassigned_photos",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="menutranslation",
            constraint=models.UniqueConstraint(
                fields=("tenant", "entity_type", "entity_id", "language", "field"),
                name="unique_menu_translation_key",
            ),
        ),
        migrations.AddConstraint(
            model_name="unassignedphoto",
            constraint=models.UniqueConstraint(
                fields=("tenant", "file_sha256"),
                name="unique_tenant_unassigned_photo_sha256",
            ),
        ),
        migrations.RunPython(_forwards_migrate_menu_tools, migrations.RunPython.noop),
    ]
