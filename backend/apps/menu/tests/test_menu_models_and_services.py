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
    assert exc_svg.value.error_code == "INVALID_IMAGE_FORMAT"

    # 2. Reject Corrupt / Non-image bytes
    bad_file = SimpleUploadedFile("broken.png", b"NOT AN IMAGE", content_type="image/png")
    with pytest.raises(BusinessRuleError) as exc_bad:
        process_and_store_menu_image(tenant=t, item=item, file_obj=bad_file, user=u)
    assert exc_bad.value.error_code == "INVALID_IMAGE_FORMAT"

    # 3. Accept valid PNG and generate card and thumb
    img_byte_arr = io.BytesIO()
    test_pil = Image.new("RGB", (1200, 800), color="blue")
    test_pil.save(img_byte_arr, format="PNG")
    valid_file = SimpleUploadedFile("coffee.png", img_byte_arr.getvalue(), content_type="image/png")

    res = process_and_store_menu_image(
        tenant=t, item=item, file_obj=valid_file, focus_x=0.5, focus_y=0.5, user=u
    )
    assert res["image_bytes"] > 0
    assert "original.webp" in res["image_original"]
    assert "card.webp" in res["image_card"]
    assert "thumb.webp" in res["image_thumb"]

    # Delete image
    delete_menu_image(item, user=u)
    item.refresh_from_db()
    assert item.image_original == ""
    assert item.image_bytes == 0


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
