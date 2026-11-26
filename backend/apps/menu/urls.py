from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.menu.views import (
    BranchItemAvailabilityViewSet,
    BulkPhotoUploadView,
    FoodCatalogAddToMenuView,
    FoodCatalogListView,
    FoodCatalogUploadImageView,
    FullMenuView,
    MenuCategoryViewSet,
    MenuItemGalleryView,
    MenuItemViewSet,
    MenuTranslationView,
    OptionGroupViewSet,
    UnassignedPhotoDetailView,
    UnassignedPhotoListView,
)

router = DefaultRouter()
router.register("categories", MenuCategoryViewSet, basename="menu-categories")
router.register("items", MenuItemViewSet, basename="menu-items")
router.register("option-groups", OptionGroupViewSet, basename="menu-option-groups")
router.register("availability", BranchItemAvailabilityViewSet, basename="menu-availability")

urlpatterns = [
    path("full/", FullMenuView.as_view(), name="menu-full"),
    path("catalog/", FoodCatalogListView.as_view(), name="menu-catalog-list"),
    path(
        "catalog/<uuid:catalog_id>/add-to-menu/",
        FoodCatalogAddToMenuView.as_view(),
        name="menu-catalog-add",
    ),
    path(
        "catalog/<uuid:catalog_id>/upload-image/",
        FoodCatalogUploadImageView.as_view(),
        name="menu-catalog-upload-image",
    ),
    path("photos/bulk-upload/", BulkPhotoUploadView.as_view(), name="menu-photos-bulk-upload"),
    path("photos/unassigned/", UnassignedPhotoListView.as_view(), name="menu-photos-unassigned"),
    path(
        "photos/unassigned/apply-likely/",
        UnassignedPhotoListView.as_view(),
        name="menu-photos-apply-likely",
    ),
    path(
        "photos/unassigned/<uuid:photo_id>/",
        UnassignedPhotoDetailView.as_view(),
        name="menu-photos-unassigned-detail",
    ),
    path(
        "photos/unassigned/<uuid:photo_id>/attach/",
        UnassignedPhotoDetailView.as_view(),
        name="menu-photos-unassigned-attach",
    ),
    path(
        "items/<uuid:item_id>/images/reorder/",
        MenuItemGalleryView.as_view(),
        {"action_name": "reorder"},
        name="menu-item-images-reorder",
    ),
    path(
        "items/<uuid:item_id>/images/<uuid:image_id>/set-primary/",
        MenuItemGalleryView.as_view(),
        {"action_name": "set_primary"},
        name="menu-item-images-set-primary",
    ),
    path(
        "items/<uuid:item_id>/images/<uuid:image_id>/",
        MenuItemGalleryView.as_view(),
        name="menu-item-images-delete",
    ),
    path("translations/", MenuTranslationView.as_view(), name="menu-translations"),
    path(
        "translations/upsert/",
        MenuTranslationView.as_view(),
        {"action_name": "upsert"},
        name="menu-translations-upsert",
    ),
    path(
        "translations/review/",
        MenuTranslationView.as_view(),
        {"action_name": "review"},
        name="menu-translations-review",
    ),
    path(
        "translations/publish/",
        MenuTranslationView.as_view(),
        {"action_name": "publish"},
        name="menu-translations-publish",
    ),
    path(
        "translations/suggest/",
        MenuTranslationView.as_view(),
        {"action_name": "suggest"},
        name="menu-translations-suggest",
    ),
    path("", include(router.urls)),
]
