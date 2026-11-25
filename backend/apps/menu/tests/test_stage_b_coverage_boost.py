import io
import uuid
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.constants import FoodType
from apps.menu.models import (
    ItemImage,
    ItemVariant,
    MenuCategory,
    MenuItem,
    MenuTranslation,
    Option,
    OptionGroup,
    UnassignedPhoto,
)
from apps.menu.services import (
    MAX_IMAGE_UPLOAD_BYTES,
    attach_unassigned_photo_to_item,
    match_filename_to_menu_items,
    sync_primary_item_image_fields,
    upload_unassigned_photo,
)
from apps.menu.translation_service import (
    LLMProvider,
    ManualProvider,
    get_translation_provider,
    list_translatable_entries,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import EntitlementLimitReached
from apps.tenants.models import Branch, Tenant


def _make_img_bytes(
    fmt: str = "PNG",
    size: tuple[int, int] = (400, 300),
    mode: str = "RGB",
    color: Any = (180, 90, 40),
) -> bytes:
    buf = io.BytesIO()
    img = Image.new(mode, size, color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_animated_webp_bytes() -> bytes:
    buf = io.BytesIO()
    f1 = Image.new("RGB", (200, 200), (255, 0, 0))
    f2 = Image.new("RGB", (200, 200), (0, 255, 0))
    f1.save(buf, format="WEBP", save_all=True, append_images=[f2], duration=100, loop=0)
    return buf.getvalue()


@pytest.fixture
def menu_boost_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(name="Coverage Kitchen", slug="coverage-kitchen")
    plan = Plan.objects.create(
        name="Cov Plan",
        slug="cov-plan",
        price_paise=199900,
        entitlements={"max_menu_items": 100, "max_image_storage_mb": 50},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)
    Branch.objects.create(tenant=tenant, name="Main")

    owner = User.objects.create_user(
        email="owner@covmenu.test", password="Password123!", full_name="Owner"
    )
    Membership.objects.create(tenant=tenant, user=owner, role=Role.OWNER, is_active=True)

    waiter = User.objects.create_user(
        email="waiter@covmenu.test", password="Password123!", full_name="Waiter"
    )
    Membership.objects.create(tenant=tenant, user=waiter, role=Role.WAITER, is_active=True)

    cat = MenuCategory.objects.create(tenant=tenant, name="Mains")
    item = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Paneer Butter Masala",
        name_ta="பனீர் பட்டர் மசாலா",
        description="Rich tomato gravy",
        allergen_note="Dairy",
        base_price_paise=24000,
        food_type=FoodType.VEG,
    )
    MenuTranslation.objects.create(
        tenant=tenant,
        entity_type=MenuTranslation.EntityType.ITEM,
        entity_id=item.id,
        language="hi",
        field="name",
        text="पनीर बटर मसाला",
        status=MenuTranslation.Status.PUBLISHED,
    )

    owner_client = APIClient()
    owner_tok = str(RefreshToken.for_user(owner).access_token)
    owner_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {owner_tok}", HTTP_X_TENANT_ID=str(tenant.id)
    )

    waiter_client = APIClient()
    waiter_tok = str(RefreshToken.for_user(waiter).access_token)
    waiter_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {waiter_tok}", HTTP_X_TENANT_ID=str(tenant.id)
    )

    return {
        "tenant": tenant,
        "plan": plan,
        "owner": owner,
        "owner_client": owner_client,
        "waiter_client": waiter_client,
        "item": item,
    }


@pytest.mark.django_db
def test_menu_service_filename_matching_and_image_validation_branches(
    menu_boost_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = menu_boost_env["tenant"]
    plan: Plan = menu_boost_env["plan"]
    item: MenuItem = menu_boost_env["item"]

    # 1. Empty query filename & zero-items tenant
    other_tenant = Tenant.objects.create(name="Empty Menu", slug="empty-menu-cov")
    assert match_filename_to_menu_items(tenant, "123.png") == (
        None,
        0.0,
        UnassignedPhoto.MatchTier.NO_MATCH,
    )
    assert match_filename_to_menu_items(other_tenant, "dosa.png") == (
        None,
        0.0,
        UnassignedPhoto.MatchTier.NO_MATCH,
    )

    # 2. CHECK tier (0.70..0.89) and NO_MATCH (<0.40 clears best_item)
    best_check, score_check, tier_check = match_filename_to_menu_items(tenant, "paneer_masala.png")
    assert best_check == item
    assert 0.70 <= score_check < 0.90
    assert tier_check == UnassignedPhoto.MatchTier.CHECK

    best_none, score_none, tier_none = match_filename_to_menu_items(tenant, "zzzz_xyz.png")
    assert best_none is None
    assert score_none < 0.40
    assert tier_none == UnassignedPhoto.MatchTier.NO_MATCH

    # 3. File too large
    class OversizeFile(io.BytesIO):
        size = MAX_IMAGE_UPLOAD_BYTES + 10
        name = "huge.png"

    with pytest.raises(BusinessRuleError, match="exceeds maximum upload size"):
        upload_unassigned_photo(tenant=tenant, file_obj=OversizeFile(b"x"))

    # 4. Unsupported format (GIF) even if named .png
    gif_bytes = _make_img_bytes(fmt="GIF")
    with pytest.raises(BusinessRuleError, match="Unsupported image format"):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("tricky.png", gif_bytes, content_type="image/png"),
        )

    # 5. Animated WebP rejected
    anim_bytes = _make_animated_webp_bytes()
    with pytest.raises(BusinessRuleError, match="Animated images"):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("anim.webp", anim_bytes, content_type="image/webp"),
        )

    # 6. Corrupt decode error & DecompressionBombError
    with pytest.raises(BusinessRuleError, match="Could not decode image"):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("corrupt.png", b"not-an-image", content_type="image/png"),
        )

    def _raise_bomb(*args: Any, **kwargs: Any) -> Any:
        raise Image.DecompressionBombError("too big")

    monkeypatch.setattr(Image, "open", _raise_bomb)
    with pytest.raises(BusinessRuleError, match="decompression bomb"):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("bomb.png", b"1234", content_type="image/png"),
        )
    monkeypatch.undo()

    # 7. Image too small (< min width/height)
    tiny_bytes = _make_img_bytes(fmt="PNG", size=(50, 50))
    with pytest.raises(BusinessRuleError, match="below minimum required resolution"):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("tiny.png", tiny_bytes, content_type="image/png"),
        )

    # 8. RGBA transparency & resize > MAX_IMAGE_DIMENSION, plus duplicate sha256 idempotency
    big_rgba = _make_img_bytes(fmt="PNG", size=(1800, 1400), mode="RGBA", color=(255, 0, 0, 128))
    p1 = upload_unassigned_photo(
        tenant=tenant,
        file_obj=SimpleUploadedFile("paneer_butter_masala.png", big_rgba, content_type="image/png"),
    )
    p2 = upload_unassigned_photo(
        tenant=tenant,
        file_obj=SimpleUploadedFile("paneer_butter_masala.png", big_rgba, content_type="image/png"),
    )
    assert p1.id == p2.id

    # 9. Storage quota limit reached
    plan.entitlements = {"max_menu_items": 100, "max_image_storage_mb": 0}
    plan.save(update_fields=["entitlements"])
    valid_png = _make_img_bytes(fmt="PNG", size=(400, 300))
    with pytest.raises(EntitlementLimitReached):
        upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile("quota.png", valid_png, content_type="image/png"),
        )
    plan.entitlements = {"max_menu_items": 100, "max_image_storage_mb": 50}
    plan.save(update_fields=["entitlements"])

    # 10. Cross-tenant attach error & >5 gallery limit & empty gallery sync
    other_cat = MenuCategory.objects.create(tenant=other_tenant, name="Other")
    other_item = MenuItem.objects.create(
        tenant=other_tenant, category=other_cat, name="Other Dish", base_price_paise=10000
    )
    with pytest.raises(BusinessRuleError, match="does not belong"):
        attach_unassigned_photo_to_item(photo=p1, item=other_item)

    sync_primary_item_image_fields(other_item)
    assert other_item.image_bytes == 0

    for idx in range(5):
        ph = upload_unassigned_photo(
            tenant=tenant,
            file_obj=SimpleUploadedFile(
                f"g_{idx}.png",
                _make_img_bytes(fmt="PNG", size=(400, 300), color=(idx * 30, 50, 90)),
                content_type="image/png",
            ),
        )
        attach_unassigned_photo_to_item(photo=ph, item=item)
    with pytest.raises(BusinessRuleError, match="at most 5 gallery images"):
        attach_unassigned_photo_to_item(photo=p1, item=item)


@pytest.mark.django_db
def test_menu_views_gallery_bulk_photos_and_translations_endpoints(
    menu_boost_env: dict[str, Any],
) -> None:
    tenant: Tenant = menu_boost_env["tenant"]
    owner_client: APIClient = menu_boost_env["owner_client"]
    waiter_client: APIClient = menu_boost_env["waiter_client"]
    item: MenuItem = menu_boost_env["item"]

    # Gallery item upload, reorder, set_primary, invalid action, delete
    ph1 = upload_unassigned_photo(
        tenant=tenant,
        file_obj=SimpleUploadedFile("a.png", _make_img_bytes(color=(10, 20, 30)), "image/png"),
    )
    ph2 = upload_unassigned_photo(
        tenant=tenant,
        file_obj=SimpleUploadedFile("b.png", _make_img_bytes(color=(40, 50, 60)), "image/png"),
    )
    img1 = attach_unassigned_photo_to_item(photo=ph1, item=item)
    img2 = attach_unassigned_photo_to_item(photo=ph2, item=item)
    assert isinstance(img1, ItemImage) and isinstance(img2, ItemImage)

    assert (
        owner_client.post(
            f"/api/v1/menu/items/{item.id}/images/reorder/",
            {"image_ids": [str(img2.id), str(img1.id)]},
            format="json",
        ).status_code
        == 200
    )
    assert (
        owner_client.post(
            f"/api/v1/menu/items/{item.id}/images/{img2.id}/set-primary/", {}, format="json"
        ).status_code
        == 200
    )
    assert (
        owner_client.post(
            f"/api/v1/menu/items/{uuid.uuid4()}/images/reorder/",
            {"image_ids": []},
            format="json",
        ).status_code
        == 404
    )
    assert (
        owner_client.post(
            f"/api/v1/menu/items/{item.id}/images/{uuid.uuid4()}/set-primary/",
            {},
            format="json",
        ).status_code
        == 404
    )
    assert owner_client.delete(f"/api/v1/menu/items/{item.id}/images/{img1.id}/").status_code == 204
    assert owner_client.delete(f"/api/v1/menu/items/{item.id}/images/{img2.id}/").status_code == 204
    assert item.gallery_images.count() == 0

    # Bulk upload edge errors: no files, >50 files, list & detail attach/delete
    assert owner_client.post("/api/v1/menu/photos/bulk-upload/", {}).status_code == 400
    many = [SimpleUploadedFile(f"f{i}.png", b"x", content_type="image/png") for i in range(51)]
    assert owner_client.post("/api/v1/menu/photos/bulk-upload/", {"files": many}).status_code == 400

    valid_file = SimpleUploadedFile(
        "paneer_butter_masala.png", _make_img_bytes(), content_type="image/png"
    )
    assert (
        owner_client.post("/api/v1/menu/photos/bulk-upload/", {"files": [valid_file]}).status_code
        == 201
    )
    list_res = owner_client.get("/api/v1/menu/photos/unassigned/")
    assert list_res.status_code == 200 and len(list_res.data) == 1
    photo_id = list_res.data[0]["id"]

    # Bad item_id -> 400 INVALID_REFERENCE, valid -> 201, delete non-existent -> 404
    assert (
        owner_client.post(
            f"/api/v1/menu/photos/unassigned/{photo_id}/attach/",
            {"item_id": "not-a-uuid"},
            format="json",
        ).status_code
        == 400
    )
    assert (
        owner_client.post(
            f"/api/v1/menu/photos/unassigned/{photo_id}/attach/",
            {"item_id": str(uuid.uuid4())},
            format="json",
        ).status_code
        == 400
    )
    assert (
        owner_client.post(
            f"/api/v1/menu/photos/unassigned/{photo_id}/attach/",
            {"item_id": str(item.id)},
            format="json",
        ).status_code
        == 201
    )
    assert owner_client.delete(f"/api/v1/menu/photos/unassigned/{photo_id}/").status_code == 404

    # Unassigned upload then delete 204
    extra_file = SimpleUploadedFile(
        "extra_photo.png", _make_img_bytes(color=(11, 22, 33)), content_type="image/png"
    )
    up2 = owner_client.post("/api/v1/menu/photos/bulk-upload/", {"files": [extra_file]})
    assert (
        owner_client.delete(
            f"/api/v1/menu/photos/unassigned/{up2.data['uploaded'][0]['id']}/"
        ).status_code
        == 204
    )

    # Translation endpoints: waiter forbidden, invalid language, GET list, review, suggest
    assert waiter_client.get("/api/v1/menu/translations/?language=ta").status_code == 403
    assert owner_client.get("/api/v1/menu/translations/?language=xx").status_code == 400
    tr_get = owner_client.get("/api/v1/menu/translations/?language=ta")
    assert tr_get.status_code == 200
    assert owner_client.post(
        "/api/v1/menu/translations/suggest/", {"language": "ta"}, format="json"
    ).status_code in (200, 400)
    assert (
        owner_client.post(
            "/api/v1/menu/translations/suggest/", {"language": "xx"}, format="json"
        ).status_code
        == 400
    )
    assert (
        owner_client.post(
            "/api/v1/menu/translations/review/",
            {
                "entity_type": "ITEM",
                "entity_id": str(item.id),
                "language": "ta",
                "field": "description",
                "text": "தக்காளி கிரேவி",
                "original_text": item.description,
            },
            format="json",
        ).status_code
        == 200
    )
    assert (
        owner_client.post(
            "/api/v1/menu/translations/upsert/",
            {
                "entity_type": "ITEM",
                "entity_id": str(item.id),
                "language": "xx",
                "field": "name",
                "text": "Bad",
            },
            format="json",
        ).status_code
        == 400
    )

    # Variants, OptionGroups, Options in translation entries + provider branches
    ItemVariant.objects.create(item=item, name="Regular", price_paise=24000)
    og = OptionGroup.objects.create(tenant=tenant, name="Spice")
    Option.objects.create(group=og, name="Medium")
    entries = list_translatable_entries(tenant, "ta")
    assert any(e["entity_type"] == "VARIANT" for e in entries)
    assert any(e["entity_type"] == "OPTION_GROUP" for e in entries)
    assert any(e["entity_type"] == "OPTION" for e in entries)

    assert ManualProvider().translate_batch(["Tea"], "ta") == [""]
    with pytest.raises(BusinessRuleError, match="not configured"):
        LLMProvider("test", "", "gpt").translate_batch(["Tea"], "ta")
    with pytest.raises(BusinessRuleError, match="configured provider endpoint"):
        LLMProvider("test", "k-123", "gpt").translate_batch(["Tea"], "ta")
    assert get_translation_provider().name == "manual"
