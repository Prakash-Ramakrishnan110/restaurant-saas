import io
from typing import Any

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Min, Sum
from PIL import Image

from apps.audit.services import log_audit_event
from apps.core.exceptions import BusinessRuleError
from apps.menu.constants import (
    CARD_IMAGE_SIZE,
    MAX_IMAGE_DIMENSION,
    MAX_IMAGE_UPLOAD_BYTES,
    THUMB_IMAGE_SIZE,
)
from apps.menu.models import (
    MenuCategory,
    MenuItem,
)
from apps.subscriptions.services import EntitlementLimitReached, get_entitlement


def sync_item_base_price(item: MenuItem) -> None:
    """Invariant: If variants exist, base_price_paise matches the default or lowest variant price."""
    default_var = item.variants.filter(is_default=True).first()
    if default_var:
        new_price = default_var.price_paise
    else:
        min_var = item.variants.aggregate(m=Min("price_paise"))["m"]
        if min_var is not None:
            new_price = min_var
        else:
            return

    if item.base_price_paise != new_price:
        old_price = item.base_price_paise
        item.base_price_paise = new_price
        item.save(update_fields=["base_price_paise", "updated_at"])
        log_audit_event(
            action="menu.item.price_sync",
            entity_type="MenuItem",
            entity_id=str(item.id),
            tenant=item.tenant,
            before_state={"price_paise": old_price},
            after_state={"price_paise": new_price, "reason": "variant_sync"},
        )


def _crop_with_focus(
    img: Image.Image, target_w: int, target_h: int, focus_x: float, focus_y: float
) -> Image.Image:
    """Crop image to target aspect ratio centered around focus_x, focus_y (0.0 to 1.0) and resize."""
    orig_w, orig_h = img.size
    target_aspect = target_w / target_h
    orig_aspect = orig_w / orig_h

    if orig_aspect > target_aspect:
        # Original is wider than target: crop width
        crop_h = orig_h
        crop_w = int(orig_h * target_aspect)
        # Center crop around focus_x
        center_x = int(orig_w * focus_x)
        x1 = max(0, min(center_x - crop_w // 2, orig_w - crop_w))
        y1 = 0
    else:
        # Original is taller than target: crop height
        crop_w = orig_w
        crop_h = int(orig_w / target_aspect)
        # Center crop around focus_y
        center_y = int(orig_h * focus_y)
        y1 = max(0, min(center_y - crop_h // 2, orig_h - crop_h))
        x1 = 0

    x2 = x1 + crop_w
    y2 = y1 + crop_h

    cropped = img.crop((x1, y1, x2, y2))
    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def process_and_store_menu_image(
    tenant: Any,
    item: MenuItem,
    file_obj: Any,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
    user: Any = None,
) -> dict[str, Any]:
    """Process uploaded menu item image through secure pipeline:

    1. Verify magic bytes & file size (<= 5MB).
    2. Enforce allowed formats: JPEG, PNG, WebP (strictly NO SVG, TIFF, executables).
    3. Strip all EXIF / GPS metadata by re-encoding clean pixel data.
    4. Generate Clean Original (max 2000px), Card (800x600 WebP), Thumb (300x300 WebP).
    5. Check tenant image storage entitlement (max_image_storage_mb).
    6. Save to storage, update MenuItem and write audit log.
    """
    if file_obj.size > MAX_IMAGE_UPLOAD_BYTES:
        raise BusinessRuleError(
            "FILE_TOO_LARGE",
            f"Image exceeds maximum upload size of {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)}MB.",
            status_code=400,
        )

    try:
        raw_bytes = file_obj.read()
        pil_img = Image.open(io.BytesIO(raw_bytes))
        format_name = (pil_img.format or "").upper()
        if format_name not in {"JPEG", "JPG", "PNG", "WEBP"}:
            raise BusinessRuleError(
                "INVALID_IMAGE_FORMAT",
                f"Unsupported image format '{format_name}'. Only JPEG, PNG, and WebP are accepted.",
                status_code=400,
            )
        # Verify image integrity
        pil_img.verify()
        # Re-open after verify()
        pil_img = Image.open(io.BytesIO(raw_bytes))
    except BusinessRuleError:
        raise
    except Exception as exc:
        raise BusinessRuleError(
            "INVALID_IMAGE_FORMAT",
            f"Could not decode image file: {exc}",
            status_code=400,
        ) from exc

    # Strip metadata by converting to clean RGB/RGBA mode
    if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
        clean_img = Image.new("RGBA", pil_img.size)
        clean_img.paste(pil_img)
    else:
        clean_img = Image.new("RGB", pil_img.size)
        clean_img.paste(pil_img)

    # 1. Cleaned original (scaled down if exceeds MAX_IMAGE_DIMENSION)
    orig_w, orig_h = clean_img.size
    orig_copy = clean_img.copy()
    if orig_w > MAX_IMAGE_DIMENSION or orig_h > MAX_IMAGE_DIMENSION:
        orig_copy.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)

    orig_buf = io.BytesIO()
    # Save original as WebP for efficiency
    orig_copy.save(orig_buf, format="WEBP", quality=90, method=6)
    orig_bytes = orig_buf.getvalue()

    # 2. Card (800x600 WebP cropped with focus)
    card_img = _crop_with_focus(clean_img, CARD_IMAGE_SIZE[0], CARD_IMAGE_SIZE[1], focus_x, focus_y)
    card_buf = io.BytesIO()
    card_img.save(card_buf, format="WEBP", quality=85, method=6)
    card_bytes = card_buf.getvalue()

    # 3. Thumb (300x300 WebP cropped with focus)
    thumb_img = _crop_with_focus(
        clean_img, THUMB_IMAGE_SIZE[0], THUMB_IMAGE_SIZE[1], focus_x, focus_y
    )
    thumb_buf = io.BytesIO()
    thumb_img.save(thumb_buf, format="WEBP", quality=85, method=6)
    thumb_bytes = thumb_buf.getvalue()

    new_total_bytes = len(orig_bytes) + len(card_bytes) + len(thumb_bytes)

    # Check max_image_storage_mb entitlement
    current_storage_bytes = (
        MenuItem.objects.filter(tenant=tenant)
        .exclude(id=item.id)
        .aggregate(s=Sum("image_bytes"))["s"]
        or 0
    )
    total_after_upload_mb = (current_storage_bytes + new_total_bytes) / (1024 * 1024)
    storage_limit_mb = get_entitlement(tenant, "max_image_storage_mb", 50)
    if storage_limit_mb is not None and total_after_upload_mb > storage_limit_mb:
        raise EntitlementLimitReached(
            f"Image storage limit of {storage_limit_mb}MB reached.",
            limit_key="max_image_storage_mb",
            limit=storage_limit_mb,
            current=int(current_storage_bytes / (1024 * 1024)),
        )

    # Clean up previous images if present
    delete_menu_image_files(item)

    # Store files in storage
    base_dir = f"menu/{tenant.id}/{item.id}"
    orig_path = f"{base_dir}/original.webp"
    card_path = f"{base_dir}/card.webp"
    thumb_path = f"{base_dir}/thumb.webp"

    default_storage.save(orig_path, io.BytesIO(orig_bytes))
    default_storage.save(card_path, io.BytesIO(card_bytes))
    default_storage.save(thumb_path, io.BytesIO(thumb_bytes))

    item.image_original = default_storage.url(orig_path)
    item.image_card = default_storage.url(card_path)
    item.image_thumb = default_storage.url(thumb_path)
    item.image_bytes = new_total_bytes
    item.image_focus_x = focus_x
    item.image_focus_y = focus_y
    item.save(
        update_fields=[
            "image_original",
            "image_card",
            "image_thumb",
            "image_bytes",
            "image_focus_x",
            "image_focus_y",
            "updated_at",
        ]
    )

    log_audit_event(
        action="menu.item.image_upload",
        entity_type="MenuItem",
        entity_id=str(item.id),
        actor=user,
        tenant=tenant,
        after_state={"bytes": new_total_bytes, "focus": [focus_x, focus_y]},
    )

    return {
        "image_original": item.image_original,
        "image_card": item.image_card,
        "image_thumb": item.image_thumb,
        "image_bytes": item.image_bytes,
        "image_focus_x": item.image_focus_x,
        "image_focus_y": item.image_focus_y,
    }


def delete_menu_image_files(item: MenuItem) -> None:
    """Remove underlying media storage files for a menu item."""
    base_dir = f"menu/{item.tenant_id}/{item.id}"
    for filename in ["original.webp", "card.webp", "thumb.webp"]:
        path = f"{base_dir}/{filename}"
        if default_storage.exists(path):
            try:
                default_storage.delete(path)
            except Exception:
                pass


def delete_menu_image(item: MenuItem, user: Any = None) -> None:
    """Delete all images associated with a menu item and reset fields."""
    delete_menu_image_files(item)
    item.image_original = ""
    item.image_card = ""
    item.image_thumb = ""
    item.image_bytes = 0
    item.image_focus_x = 0.5
    item.image_focus_y = 0.5
    item.save(
        update_fields=[
            "image_original",
            "image_card",
            "image_thumb",
            "image_bytes",
            "image_focus_x",
            "image_focus_y",
            "updated_at",
        ]
    )
    log_audit_event(
        action="menu.item.image_delete",
        entity_type="MenuItem",
        entity_id=str(item.id),
        actor=user,
        tenant=item.tenant,
    )


def bulk_create_menu_items(
    tenant: Any,
    items_data: list[dict[str, Any]],
    user: Any = None,
) -> list[MenuItem]:
    """Bulk create menu items atomically (up to 100 items per request).

    Validates plan entitlement and writes audit event.
    """
    if len(items_data) > 100:
        raise BusinessRuleError(
            "BATCH_SIZE_EXCEEDED",
            "Cannot bulk create more than 100 items in a single request.",
            status_code=400,
        )

    current_count = MenuItem.objects.filter(tenant=tenant).count()
    limit = get_entitlement(tenant, "max_menu_items", 100)
    if limit is not None and (current_count + len(items_data)) > limit:
        raise EntitlementLimitReached(
            f"Bulk create would exceed plan limit of {limit} menu items.",
            limit_key="max_menu_items",
            limit=limit,
            current=current_count,
            requested=len(items_data),
        )

    # Validate categories exist and belong to tenant
    cat_cache: dict[str, MenuCategory] = {}
    created_items: list[MenuItem] = []

    with transaction.atomic():
        for idx, row in enumerate(items_data):
            cat_name = row.get("category_name") or row.get("category")
            if not cat_name:
                raise BusinessRuleError(
                    "INVALID_PAYLOAD",
                    f"Row {idx + 1}: Category name is required.",
                    status_code=400,
                )

            if cat_name not in cat_cache:
                cat, _ = MenuCategory.objects.get_or_create(
                    tenant=tenant,
                    name=cat_name.strip(),
                    defaults={"sort_order": len(cat_cache)},
                )
                cat_cache[cat_name] = cat
            category = cat_cache[cat_name]

            item_name = (row.get("name") or "").strip()
            if not item_name:
                raise BusinessRuleError(
                    "INVALID_PAYLOAD",
                    f"Row {idx + 1}: Item name is required.",
                    status_code=400,
                )

            price_paise = row.get("base_price_paise", 0)
            if price_paise < 0:
                raise BusinessRuleError(
                    "INVALID_PRICE",
                    f"Row {idx + 1}: Price cannot be negative.",
                    status_code=400,
                )

            item = MenuItem.objects.create(
                tenant=tenant,
                category=category,
                name=item_name,
                name_ta=row.get("name_ta", ""),
                description=row.get("description", ""),
                description_ta=row.get("description_ta", ""),
                base_price_paise=price_paise,
                food_type=row.get("food_type", "VEG"),
                prep_minutes=row.get("prep_minutes"),
                is_bestseller=bool(row.get("is_bestseller", False)),
                is_active=bool(row.get("is_active", True)),
                sort_order=row.get("sort_order", current_count + idx),
            )
            created_items.append(item)

        log_audit_event(
            action="menu.item.bulk_create",
            entity_type="MenuItem",
            entity_id=str(created_items[0].id) if created_items else "",
            actor=user,
            tenant=tenant,
            after_state={"count": len(created_items)},
        )

    return created_items
