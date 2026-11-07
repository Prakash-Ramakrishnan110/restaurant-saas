import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from PIL import Image

from apps.accounts.models import User
from apps.core.exceptions import BusinessRuleError
from apps.menu.constants import FoodType
from apps.menu.models import (
    ItemVariant,
    MenuCategory,
    MenuItem,
)
from apps.menu.services import (
    bulk_create_menu_items,
    delete_menu_image,
    process_and_store_menu_image,
    sync_item_base_price,
)
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import EntitlementLimitReached
from apps.tenants.models import Branch, Tenant


@pytest.fixture
def menu_env():
    tenant = Tenant.objects.create(name="Menu Tenant", slug="menu-tenant")
    plan = Plan.objects.create(
        name="Pro Plan",
        slug="pro-plan",
        entitlements={"max_menu_items": 10, "max_image_storage_mb": 5},
    )
    Subscription.objects.create(tenant=tenant, plan=plan)
    branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    user = User.objects.create_user(
        email="chef@menu.com", password="Password123!", full_name="Chef Ramesh"
    )
    return {"tenant": tenant, "branch": branch, "plan": plan, "user": user}


@pytest.mark.django_db
def test_menu_category_and_item_unique_constraints(menu_env):
    t = menu_env["tenant"]
    cat = MenuCategory.objects.create(tenant=t, name="Starters", sort_order=1)

    # Duplicate category name in same tenant must raise IntegrityError
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            MenuCategory.objects.create(tenant=t, name="Starters", sort_order=2)

    # Item unique constraint per category
    MenuItem.objects.create(
        tenant=t,
        category=cat,
        name="Paneer Tikka",
        base_price_paise=25000,
        food_type=FoodType.VEG,
    )
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            MenuItem.objects.create(
                tenant=t,
                category=cat,
                name="Paneer Tikka",
                base_price_paise=30000,
                food_type=FoodType.VEG,
            )


@pytest.mark.django_db
def test_item_variant_default_and_price_sync(menu_env):
    t = menu_env["tenant"]
    cat = MenuCategory.objects.create(tenant=t, name="Biryani")
    item = MenuItem.objects.create(
        tenant=t,
        category=cat,
        name="Dum Biryani",
        base_price_paise=20000,
        food_type=FoodType.NON_VEG,
    )

    # Add variants
    _v1 = ItemVariant.objects.create(
        item=item, name="Half", price_paise=22000, is_default=False, sort_order=1
    )
    _v2 = ItemVariant.objects.create(
        item=item, name="Full", price_paise=35000, is_default=True, sort_order=2
    )

    # Partial unique: only one default variant per item
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            ItemVariant.objects.create(
                item=item, name="Family", price_paise=60000, is_default=True, sort_order=3
            )

    # Price sync sets item.base_price_paise to default variant price (35000)
    sync_item_base_price(item)
    item.refresh_from_db()
    assert item.base_price_paise == 35000


@pytest.mark.django_db
def test_image_pipeline_valid_and_rejections(menu_env):
    t = menu_env["tenant"]
    u = menu_env["user"]
    cat = MenuCategory.objects.create(tenant=t, name="Beverages")
    item = MenuItem.objects.create(
        tenant=t,
        category=cat,
        name="Espresso",
        base_price_paise=12000,
        food_type=FoodType.VEG,
    )

    # 1. Reject SVG file
    svg_file = SimpleUploadedFile(
        "fake.svg", b"<svg><circle r='10'/></svg>", content_type="image/svg+xml"
    )
    with pytest.raises(BusinessRuleError) as exc_svg:
        process_and_store_menu_image(tenant=t, item=item, file_obj=svg_file, user=u)
    assert exc_svg.value.error_code == "INVALID_IMAGE_EXTENSION"

    # 2. Reject Invalid Extension (.exe, .txt)
    exe_file = SimpleUploadedFile(
        "danger.exe", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/octet-stream"
    )
    with pytest.raises(BusinessRuleError) as exc_ext:
        process_and_store_menu_image(tenant=t, item=item, file_obj=exe_file, user=u)
    assert exc_ext.value.error_code == "INVALID_IMAGE_EXTENSION"

    # 3. Reject Corrupt / Non-image bytes
    bad_file = SimpleUploadedFile("broken.png", b"NOT AN IMAGE", content_type="image/png")
    with pytest.raises(BusinessRuleError) as exc_bad:
        process_and_store_menu_image(tenant=t, item=item, file_obj=bad_file, user=u)
    assert exc_bad.value.error_code == "INVALID_IMAGE_FORMAT"

    # 4. Reject File > 5MB
    large_data = b"0" * (5 * 1024 * 1024 + 1024)
    large_file = SimpleUploadedFile("huge.png", large_data, content_type="image/png")
    with pytest.raises(BusinessRuleError) as exc_large:
        process_and_store_menu_image(tenant=t, item=item, file_obj=large_file, user=u)
    assert exc_large.value.error_code == "FILE_TOO_LARGE"

    # 5. Reject Image Below 400x300
    small_buf = io.BytesIO()
    small_img = Image.new("RGB", (300, 200), color="red")
    small_img.save(small_buf, format="PNG")
    small_file = SimpleUploadedFile("small.png", small_buf.getvalue(), content_type="image/png")
    with pytest.raises(BusinessRuleError) as exc_small:
        process_and_store_menu_image(tenant=t, item=item, file_obj=small_file, user=u)
    assert exc_small.value.error_code == "IMAGE_TOO_SMALL"

    # 6. Reject Animated Image
    anim_buf = io.BytesIO()
    f1 = Image.new("RGB", (400, 400), color="red")
    f2 = Image.new("RGB", (400, 400), color="blue")
    f1.save(anim_buf, format="GIF", save_all=True, append_images=[f2], duration=200, loop=0)
    anim_file = SimpleUploadedFile("animated.gif", anim_buf.getvalue(), content_type="image/gif")
    with pytest.raises(BusinessRuleError) as exc_anim:
        process_and_store_menu_image(tenant=t, item=item, file_obj=anim_file, user=u)
    assert exc_anim.value.error_code == "INVALID_IMAGE_EXTENSION"

    # 7. Reject Decompression Bomb (mock limit)
    old_max = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = 1000
        bomb_buf = io.BytesIO()
        bomb_img = Image.new("RGB", (500, 500), color="green")
        bomb_img.save(bomb_buf, format="PNG")
        bomb_file = SimpleUploadedFile("bomb.png", bomb_buf.getvalue(), content_type="image/png")
        with pytest.raises(BusinessRuleError) as exc_bomb:
            process_and_store_menu_image(tenant=t, item=item, file_obj=bomb_file, user=u)
        assert exc_bomb.value.error_code == "DECOMPRESSION_BOMB"
    finally:
        Image.MAX_IMAGE_PIXELS = old_max

    # 8. Accept valid PNG and generate card and thumb, strip EXIF
    img_byte_arr = io.BytesIO()
    test_pil = Image.new("RGB", (1200, 800), color="blue")
    test_pil.save(img_byte_arr, format="PNG")
    valid_file = SimpleUploadedFile("coffee.png", img_byte_arr.getvalue(), content_type="image/png")

    res = process_and_store_menu_image(
        tenant=t, item=item, file_obj=valid_file, focus_x=0.0, focus_y=1.0, user=u
    )
    assert res["image_bytes"] > 0
    assert "original.webp" in res["image_original"]
    assert "card.webp" in res["image_card"]
    assert "thumb.webp" in res["image_thumb"]
    assert item.image_focus_x == 0.0
    assert item.image_focus_y == 1.0

    # 9. Replacing image deletes previous image files and updates focus
    img_byte_arr2 = io.BytesIO()
    test_pil2 = Image.new("RGB", (800, 600), color="yellow")
    test_pil2.save(img_byte_arr2, format="JPEG")
    valid_file2 = SimpleUploadedFile(
        "coffee2.jpg", img_byte_arr2.getvalue(), content_type="image/jpeg"
    )
    process_and_store_menu_image(
        tenant=t, item=item, file_obj=valid_file2, focus_x=0.8, focus_y=0.2, user=u
    )
    assert item.image_focus_x == 0.8
    assert item.image_focus_y == 0.2

    # 10. Delete image
    delete_menu_image(item, user=u)
    item.refresh_from_db()
    assert item.image_original == ""
    assert item.image_bytes == 0


@pytest.mark.django_db
def test_image_storage_quota_enforcement(menu_env):
    t = menu_env["tenant"]
    u = menu_env["user"]
    cat = MenuCategory.objects.create(tenant=t, name="Desserts")
    item = MenuItem.objects.create(
        tenant=t,
        category=cat,
        name="Lava Cake",
        base_price_paise=15000,
        food_type=FoodType.VEG,
    )

    # Set plan limit to 0MB for testing quota block
    menu_env["plan"].entitlements["max_image_storage_mb"] = 0
    menu_env["plan"].save()

    img_byte_arr = io.BytesIO()
    test_pil = Image.new("RGB", (600, 500), color="chocolate")
    test_pil.save(img_byte_arr, format="PNG")
    valid_file = SimpleUploadedFile("cake.png", img_byte_arr.getvalue(), content_type="image/png")

    with pytest.raises(EntitlementLimitReached) as exc_quota:
        process_and_store_menu_image(tenant=t, item=item, file_obj=valid_file, user=u)
    assert exc_quota.value.error_code == "ENTITLEMENT_LIMIT_REACHED"
    assert exc_quota.value.details["limit_key"] == "max_image_storage_mb"


@pytest.mark.django_db
def test_bulk_create_items_and_entitlement_gate(menu_env):
    t = menu_env["tenant"]
    u = menu_env["user"]
    _cat = MenuCategory.objects.create(tenant=t, name="Snacks")

    # Plan limit is 10 items
    rows = [
        {
            "category": "Snacks",
            "name": f"Snack Item {i}",
            "base_price_paise": 5000 + i * 100,
            "food_type": "VEG",
        }
        for i in range(8)
    ]
    created = bulk_create_menu_items(tenant=t, items_data=rows, user=u)
    assert len(created) == 8
    assert MenuItem.objects.filter(tenant=t).count() == 8

    # Attempting to add 5 more exceeds limit (8 + 5 = 13 > 10)
    extra_rows = [
        {
            "category": "Snacks",
            "name": f"Extra Item {i}",
            "base_price_paise": 6000,
            "food_type": "VEG",
        }
        for i in range(5)
    ]
    with pytest.raises(EntitlementLimitReached) as exc:
        bulk_create_menu_items(tenant=t, items_data=extra_rows, user=u)
    assert exc.value.error_code == "ENTITLEMENT_LIMIT_REACHED"


@pytest.mark.django_db
def test_bulk_create_atomic_on_invalid_category(menu_env):
    t = menu_env["tenant"]
    u = menu_env["user"]
    MenuCategory.objects.create(tenant=t, name="Beverages")
    initial_count = MenuItem.objects.filter(tenant=t).count()

    invalid_rows = [
        {"category": "Beverages", "name": "Lemonade", "base_price_paise": 5000, "food_type": "VEG"},
        {
            "category": "NonExistentCat",
            "name": "Mystery Drink",
            "base_price_paise": 8000,
            "food_type": "VEG",
        },
    ]
    with pytest.raises(BusinessRuleError) as exc:
        bulk_create_menu_items(tenant=t, items_data=invalid_rows, user=u)
    assert exc.value.error_code == "CATEGORY_NOT_FOUND"

    # Verify atomic rollback: Lemonade must NOT have been saved
    assert MenuItem.objects.filter(tenant=t).count() == initial_count
