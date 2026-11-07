import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.menu.constants import FoodType
from apps.menu.models import (
    MenuCategory,
    MenuItem,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant


@pytest.fixture
def menu_api_env():
    # Tenant A
    t_a = Tenant.objects.create(name="Tenant A", slug="tenant-a", status=Tenant.Status.ACTIVE)
    plan_a = Plan.objects.create(
        name="Pro Plan", slug="pro-a", entitlements={"max_menu_items": 100}
    )
    Subscription.objects.create(tenant=t_a, plan=plan_a, status=SubscriptionStatus.ACTIVE)
    b_a = Branch.objects.create(tenant=t_a, name="Branch A")

    u_owner = User.objects.create_user(
        email="owner@tenant-a.com", password="Password123!", full_name="Owner A"
    )
    Membership.objects.create(user=u_owner, tenant=t_a, role=Role.OWNER, is_active=True)

    u_waiter = User.objects.create_user(
        email="waiter@tenant-a.com", password="Password123!", full_name="Waiter A"
    )
    Membership.objects.create(user=u_waiter, tenant=t_a, role=Role.WAITER, is_active=True)

    cat_a = MenuCategory.objects.create(tenant=t_a, name="Main Dishes", sort_order=1)
    item_a = MenuItem.objects.create(
        tenant=t_a,
        category=cat_a,
        name="Paneer Butter Masala",
        base_price_paise=28000,
        food_type=FoodType.VEG,
    )

    # Tenant B
    t_b = Tenant.objects.create(name="Tenant B", slug="tenant-b", status=Tenant.Status.ACTIVE)
    plan_b = Plan.objects.create(
        name="Pro Plan B", slug="pro-b", entitlements={"max_menu_items": 100}
    )
    Subscription.objects.create(tenant=t_b, plan=plan_b, status=SubscriptionStatus.ACTIVE)
    b_b = Branch.objects.create(tenant=t_b, name="Branch B")

    u_owner_b = User.objects.create_user(
        email="owner@tenant-b.com", password="Password123!", full_name="Owner B"
    )
    Membership.objects.create(user=u_owner_b, tenant=t_b, role=Role.OWNER, is_active=True)

    cat_b = MenuCategory.objects.create(tenant=t_b, name="Secret Category", sort_order=1)
    item_b = MenuItem.objects.create(
        tenant=t_b,
        category=cat_b,
        name="Secret Dish",
        base_price_paise=99900,
        food_type=FoodType.NON_VEG,
    )

    return {
        "t_a": t_a,
        "b_a": b_a,
        "u_owner": u_owner,
        "u_waiter": u_waiter,
        "cat_a": cat_a,
        "item_a": item_a,
        "t_b": t_b,
        "b_b": b_b,
        "u_owner_b": u_owner_b,
        "cat_b": cat_b,
        "item_b": item_b,
    }


def make_client(user, tenant):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    client.defaults["HTTP_X_TENANT_ID"] = str(tenant.id)
    return client


@pytest.mark.django_db
def test_menu_tenant_isolation(menu_api_env):
    client_a = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])

    # Tenant A list categories: sees only Main Dishes
    res_cats = client_a.get("/api/v1/menu/categories/")
    assert res_cats.status_code == 200
    cat_names = [c["name"] for c in res_cats.data["results"]]
    assert "Main Dishes" in cat_names
    assert "Secret Category" not in cat_names

    # Tenant A list items: sees only Paneer Butter Masala
    res_items = client_a.get("/api/v1/menu/items/")
    assert res_items.status_code == 200
    item_names = [i["name"] for i in res_items.data["results"]]
    assert "Paneer Butter Masala" in item_names
    assert "Secret Dish" not in item_names

    # Tenant A attempt to fetch Tenant B item by ID returns 404 (NEVER 403)
    res_b_item = client_a.get(f"/api/v1/menu/items/{menu_api_env['item_b'].id}/")
    assert res_b_item.status_code == 404


@pytest.mark.django_db
def test_menu_rbac_permissions(menu_api_env):
    client_owner = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    client_waiter = make_client(menu_api_env["u_waiter"], menu_api_env["t_a"])

    # 1. Waiter can view items
    res_view = client_waiter.get("/api/v1/menu/items/")
    assert res_view.status_code == 200

    # 2. Waiter CANNOT create item (403 forbidden)
    res_create = client_waiter.post(
        "/api/v1/menu/items/",
        {
            "category": str(menu_api_env["cat_a"].id),
            "name": "Waiter Added Dish",
            "base_price_paise": 15000,
            "food_type": "VEG",
        },
    )
    assert res_create.status_code == 403

    # 3. Owner CAN create item
    res_owner_create = client_owner.post(
        "/api/v1/menu/items/",
        {
            "category": str(menu_api_env["cat_a"].id),
            "name": "Owner Added Dish",
            "base_price_paise": 18000,
            "food_type": "VEG",
        },
    )
    assert res_owner_create.status_code == 201

    # 4. Waiter CANNOT toggle item availability (Waiter has no menu.availability permission -> 403)
    res_avail = client_waiter.post(
        "/api/v1/menu/availability/toggle/",
        {
            "branch": str(menu_api_env["b_a"].id),
            "item": str(menu_api_env["item_a"].id),
            "is_available": False,
        },
    )
    assert res_avail.status_code == 403

    # 5. Owner CAN toggle item availability
    res_owner_avail = client_owner.post(
        "/api/v1/menu/availability/toggle/",
        {
            "branch": str(menu_api_env["b_a"].id),
            "item": str(menu_api_env["item_a"].id),
            "is_available": False,
        },
    )
    assert res_owner_avail.status_code == 200
    assert res_owner_avail.data["is_available"] is False


@pytest.mark.django_db
def test_menu_full_active_read_endpoint(menu_api_env):
    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    res = client.get(f"/api/v1/menu/full/?branch={menu_api_env['b_a'].id}")
    assert res.status_code == 200
    assert "categories" in res.data
    cats = res.data["categories"]
    assert len(cats) >= 1
    assert cats[0]["name"] == "Main Dishes"
    items = cats[0]["items"]
    assert len(items) >= 1
    assert items[0]["name"] == "Paneer Butter Masala"


@pytest.mark.django_db
def test_category_and_item_crud_actions(menu_api_env):
    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])

    # 1. Category update
    cat = menu_api_env["cat_a"]
    res_up = client.patch(f"/api/v1/menu/categories/{cat.id}/", {"name": "Updated Main Dishes"})
    assert res_up.status_code == 200

    # 2. Category reorder
    res_reorder = client.post(
        "/api/v1/menu/categories/reorder/",
        {"orders": [{"id": str(cat.id), "sort_order": 5}]},
        format="json",
    )
    assert res_reorder.status_code == 200

    # 3. Category delete protected when items exist
    res_del_fail = client.delete(f"/api/v1/menu/categories/{cat.id}/")
    assert res_del_fail.status_code == 400

    # Empty category can be deleted
    empty_cat = MenuCategory.objects.create(tenant=menu_api_env["t_a"], name="Empty Cat")
    res_del_ok = client.delete(f"/api/v1/menu/categories/{empty_cat.id}/")
    assert res_del_ok.status_code == 204

    # 4. Item update with price change
    item = menu_api_env["item_a"]
    res_it_up = client.patch(f"/api/v1/menu/items/{item.id}/", {"base_price_paise": 32000})
    assert res_it_up.status_code == 200
    assert res_it_up.data["base_price_paise"] == 32000

    # 5. Variants PUT
    res_var = client.put(
        f"/api/v1/menu/items/{item.id}/variants/",
        {
            "variants": [
                {"name": "Half", "price_paise": 20000, "is_default": False},
                {"name": "Full", "price_paise": 35000, "is_default": True},
            ]
        },
        format="json",
    )
    assert res_var.status_code == 200
    assert len(res_var.data) == 2

    # 6. Option groups CRUD & ItemOptionGroups PUT
    res_og = client.post(
        "/api/v1/menu/option-groups/",
        {
            "name": "Spice",
            "min_select": 1,
            "max_select": 1,
            "options": [
                {"name": "Mild", "price_delta_paise": 0},
                {"name": "Hot", "price_delta_paise": 1000},
            ],
        },
        format="json",
    )
    assert res_og.status_code == 201
    og_id = res_og.data["id"]

    res_link = client.put(
        f"/api/v1/menu/items/{item.id}/option-groups/",
        {"group_ids": [og_id]},
        format="json",
    )
    assert res_link.status_code == 200

    # 7. Bulk availability toggle
    res_bulk_avail = client.post(
        "/api/v1/menu/availability/bulk-toggle/",
        {"branch": str(menu_api_env["b_a"].id), "item_ids": [str(item.id)], "is_available": False},
        format="json",
    )
    assert res_bulk_avail.status_code == 200

    # 8. Item delete
    res_it_del = client.delete(f"/api/v1/menu/items/{item.id}/")
    assert res_it_del.status_code == 204


@pytest.mark.django_db
def test_item_image_endpoints(menu_api_env):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    item = menu_api_env["item_a"]

    buf = io.BytesIO()
    img = Image.new("RGB", (800, 600), color="red")
    img.save(buf, format="JPEG")
    f = SimpleUploadedFile("dish.jpg", buf.getvalue(), content_type="image/jpeg")

    res = client.post(
        f"/api/v1/menu/items/{item.id}/image/",
        {"image": f, "focus_x": 0.5, "focus_y": 0.5},
        format="multipart",
    )
    assert res.status_code == 200
    assert "card.webp" in res.data["image_card"]

    # Delete image endpoint
    res_del = client.delete(f"/api/v1/menu/items/{item.id}/image/")
    assert res_del.status_code == 200


@pytest.mark.django_db
def test_menu_cross_tenant_body_id_isolation(menu_api_env):
    client_a = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])

    # Attempt to create an item in Tenant A using Tenant B's category ID
    res = client_a.post(
        "/api/v1/menu/items/",
        {
            "category": str(menu_api_env["cat_b"].id),
            "name": "Malicious Cross Tenant Item",
            "base_price_paise": 15000,
            "food_type": "VEG",
        },
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_menu_item_price_update_audit_log(menu_api_env):
    from apps.audit.models import AuditLog

    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    item = menu_api_env["item_a"]
    old_price = item.base_price_paise

    res = client.patch(f"/api/v1/menu/items/{item.id}/", {"base_price_paise": 35000})
    assert res.status_code == 200

    log = (
        AuditLog.objects.filter(
            tenant=menu_api_env["t_a"],
            action="menu.item.update",
            entity_id=str(item.id),
        )
        .order_by("-timestamp")
        .first()
    )

    assert log is not None
    assert log.after_state["old_price_paise"] == old_price
    assert log.after_state["new_price_paise"] == 35000


@pytest.mark.django_db
def test_menu_item_tamil_text_search(menu_api_env):
    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    cat = menu_api_env["cat_a"]

    MenuItem.objects.create(
        tenant=menu_api_env["t_a"],
        category=cat,
        name="Masala Dosa",
        name_ta="மசாலா தோசை",
        base_price_paise=10000,
        food_type=FoodType.VEG,
    )

    # Search by English
    res_en = client.get("/api/v1/menu/items/?search=dosa")
    assert res_en.status_code == 200
    names_en = [i["name"] for i in res_en.data["results"]]
    assert "Masala Dosa" in names_en

    # Search by Tamil
    res_ta = client.get("/api/v1/menu/items/?search=தோசை")
    assert res_ta.status_code == 200
    names_ta = [i["name"] for i in res_ta.data["results"]]
    assert "Masala Dosa" in names_ta


@pytest.mark.django_db
def test_menu_full_constant_query_count(menu_api_env, django_assert_num_queries):
    client = make_client(menu_api_env["u_owner"], menu_api_env["t_a"])
    t = menu_api_env["t_a"]
    b = menu_api_env["b_a"]

    # Create 5 categories and 200 items in bulk
    cats = [MenuCategory.objects.create(tenant=t, name=f"Bulk Category {c}") for c in range(5)]
    items_to_create = []
    for i in range(200):
        items_to_create.append(
            MenuItem(
                tenant=t,
                category=cats[i % 5],
                name=f"Bulk Item {i}",
                base_price_paise=10000 + i * 50,
                food_type=FoodType.VEG,
                is_active=True,
            )
        )
    MenuItem.objects.bulk_create(items_to_create)

    # Full menu view with 200+ items must execute in constant O(1) query count (8 queries including auth & tenant)
    with django_assert_num_queries(8):
        res = client.get(f"/api/v1/menu/full/?branch={b.id}")
        assert res.status_code == 200
        total_items = sum(len(c["items"]) for c in res.data["categories"])
        assert total_items >= 201
