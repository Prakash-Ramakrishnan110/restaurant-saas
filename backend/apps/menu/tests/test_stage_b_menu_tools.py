import io
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import ItemImage, MenuCategory, MenuItem, MenuTranslation, UnassignedPhoto
from apps.menu.services import match_filename_to_menu_items, normalize_photo_filename
from apps.menu.translation_service import get_published_translations_map, suggest_translations_batch
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.models import QRCode


def _make_png_bytes(
    width: int = 500, height: int = 400, color: tuple[int, int, int] = (200, 100, 50)
) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color)
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def menu_tools_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(name="Menu Tools Kitchen", slug="menu-tools-kitchen")
    plan = Plan.objects.create(
        name="Pro Menu",
        slug="pro-menu-tools",
        price_paise=199900,
        entitlements={"max_menu_items": 100, "max_image_storage_mb": 50},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    owner = User.objects.create_user(
        email="owner@menutools.test", password="Password123!", full_name="Menu Owner"
    )
    Membership.objects.create(tenant=tenant, user=owner, role=Role.OWNER, is_active=True)

    waiter = User.objects.create_user(
        email="waiter@menutools.test", password="Password123!", full_name="Menu Waiter"
    )
    Membership.objects.create(tenant=tenant, user=waiter, role=Role.WAITER, is_active=True)

    cat = MenuCategory.objects.create(tenant=tenant, name="Starters")
    dosa = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Masala Dosa",
        name_ta="மசாலா தோசை",
        description="Crispy dosa with spiced potato",
        ingredients_note="Rice, urad dal, potato",
        allergen_note="Contains ghee",
        base_price_paise=14000,
        food_type=FoodType.VEG,
    )
    qr = QRCode.objects.create(
        tenant=tenant,
        branch=branch,
        public_token="qr-menu-tools-001",
        is_active=True,
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
        "branch": branch,
        "owner": owner,
        "waiter": waiter,
        "owner_client": owner_client,
        "waiter_client": waiter_client,
        "dosa": dosa,
        "qr": qr,
    }


@pytest.mark.django_db
def test_b1_filename_matching_bulk_upload_and_gallery_limit(menu_tools_env: dict[str, Any]) -> None:
    tenant = menu_tools_env["tenant"]
    dosa: MenuItem = menu_tools_env["dosa"]
    owner_client: APIClient = menu_tools_env["owner_client"]
    waiter_client: APIClient = menu_tools_env["waiter_client"]

    # 1. Filename normalization & matching score
    assert normalize_photo_filename("Masala_Dosa_(1).jpg") == "masala dosa"
    item, score, tier = match_filename_to_menu_items(tenant, "masala-dosa_2.png")
    assert item == dosa
    assert score >= 0.90
    assert tier == UnassignedPhoto.MatchTier.LIKELY

    # 2. Waiter cannot bulk upload photos (403)
    png_file = SimpleUploadedFile("masala_dosa.png", _make_png_bytes(), content_type="image/png")
    res_waiter = waiter_client.post("/api/v1/menu/photos/bulk-upload/", {"files": [png_file]})
    assert res_waiter.status_code == 403

    # 3. SVG upload is rejected, valid PNG goes to UnassignedPhoto tray (never auto-attached)
    svg_file = SimpleUploadedFile("evil.svg", b"<svg></svg>", content_type="image/svg+xml")
    valid_file = SimpleUploadedFile("masala_dosa.png", _make_png_bytes(), content_type="image/png")
    res_up = owner_client.post(
        "/api/v1/menu/photos/bulk-upload/",
        {"files": [svg_file, valid_file]},
    )
    assert res_up.status_code == 201
    assert len(res_up.data["uploaded"]) == 1
    assert len(res_up.data["errors"]) == 1
    assert dosa.gallery_images.count() == 0

    # 4. Apply all likely attaches to gallery, and gallery max limit = 5 is enforced
    apply_res = owner_client.post("/api/v1/menu/photos/unassigned/apply-likely/", {})
    assert apply_res.status_code == 200
    assert apply_res.data["attached_count"] == 1
    assert ItemImage.objects.filter(item=dosa).count() == 1


@pytest.mark.django_db
def test_b2_translations_workflow_outdated_and_published_only_public(
    menu_tools_env: dict[str, Any],
) -> None:
    tenant = menu_tools_env["tenant"]
    dosa: MenuItem = menu_tools_env["dosa"]
    owner_client: APIClient = menu_tools_env["owner_client"]
    qr: QRCode = menu_tools_env["qr"]

    # 1. Save a DRAFT Hindi translation -> must NOT appear in published map
    res_draft = owner_client.post(
        "/api/v1/menu/translations/upsert/",
        {
            "entity_type": "ITEM",
            "entity_id": str(dosa.id),
            "language": "hi",
            "field": "name",
            "text": "मसाला डोसा (ड्राफ्ट)",
            "original_text": dosa.name,
        },
        format="json",
    )
    assert res_draft.status_code == 200
    assert ("ITEM", str(dosa.id), "name") not in get_published_translations_map(tenant, "hi")

    # 2. Publishing allergen_note requires allergen_confirmed=True
    res_no_confirm = owner_client.post(
        "/api/v1/menu/translations/publish/",
        {
            "entity_type": "ITEM",
            "entity_id": str(dosa.id),
            "language": "ta",
            "field": "allergen_note",
            "text": "நெய் உள்ளது",
            "original_text": dosa.allergen_note,
            "allergen_confirmed": False,
        },
        format="json",
    )
    assert res_no_confirm.status_code == 400
    assert res_no_confirm.data["error"]["code"] == "ALLERGEN_CONFIRMATION_REQUIRED"

    res_pub = owner_client.post(
        "/api/v1/menu/translations/publish/",
        {
            "entity_type": "ITEM",
            "entity_id": str(dosa.id),
            "language": "ta",
            "field": "allergen_note",
            "text": "நெய் உள்ளது",
            "original_text": dosa.allergen_note,
            "allergen_confirmed": True,
        },
        format="json",
    )
    assert res_pub.status_code == 200

    # 3. Public QR menu returns the published Tamil allergen note
    pub_client = APIClient()
    pub_res = pub_client.get(f"/api/v1/public/qr/{qr.public_token}/menu/?lang=ta")
    assert pub_res.status_code == 200
    item_payload = pub_res.data["categories"][0]["items"][0]
    assert item_payload["allergen_note"] == "நெய் உள்ளது"

    # 4. Updating original MenuItem name marks existing translations OUTDATED (never deleted)
    patch_res = owner_client.patch(
        f"/api/v1/menu/items/{dosa.id}/",
        {"name": "Ghee Masala Dosa"},
        format="json",
    )
    assert patch_res.status_code == 200
    tr = MenuTranslation.objects.filter(
        tenant=tenant, entity_type="ITEM", entity_id=dosa.id, language="hi", field="name"
    ).first()
    assert tr is not None
    assert tr.status == MenuTranslation.Status.OUTDATED

    # 5. Fake TranslationProvider contract (zero network calls)
    class FakeProvider:
        name = "fake"
        is_automated = True

        def translate_batch(self, texts: list[str], target_language: str) -> list[str]:
            return [f"[{target_language}] {t}" for t in texts]

    sug_res = suggest_translations_batch(
        tenant=tenant, language="hi", provider=FakeProvider(), batch_size=40
    )
    assert sug_res["suggested_count"] >= 1
