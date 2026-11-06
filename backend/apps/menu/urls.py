from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.menu.views import (
    BranchItemAvailabilityViewSet,
    FullMenuView,
    MenuCategoryViewSet,
    MenuItemViewSet,
    OptionGroupViewSet,
)

router = DefaultRouter()
router.register("categories", MenuCategoryViewSet, basename="menu-categories")
router.register("items", MenuItemViewSet, basename="menu-items")
router.register("option-groups", OptionGroupViewSet, basename="menu-option-groups")
router.register("availability", BranchItemAvailabilityViewSet, basename="menu-availability")

urlpatterns = [
    path("full/", FullMenuView.as_view(), name="menu-full"),
    path("", include(router.urls)),
]
