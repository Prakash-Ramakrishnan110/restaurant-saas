from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import (
    GoodsReceiptViewSet,
    InventoryAlertsView,
    InventoryItemViewSet,
    InventoryReportsView,
    InventorySettingsView,
    PurchaseOrderViewSet,
    RecipeViewSet,
    StockCountViewSet,
    StockHealthView,
    StockLocationViewSet,
    StockMovementViewSet,
    SupplierViewSet,
    WastageViewSet,
)

app_name = "inventory"

router = DefaultRouter()
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"locations", StockLocationViewSet, basename="location")
router.register(r"items", InventoryItemViewSet, basename="item")
router.register(r"receipts", GoodsReceiptViewSet, basename="receipt")
router.register(r"wastage", WastageViewSet, basename="wastage")
router.register(r"movements", StockMovementViewSet, basename="movement")
router.register(r"counts", StockCountViewSet, basename="count")
router.register(r"recipes", RecipeViewSet, basename="recipe")
router.register(r"purchase-orders", PurchaseOrderViewSet, basename="purchase-order")

urlpatterns = [
    path("settings/", InventorySettingsView.as_view(), name="inventory-settings"),
    path("alerts/", InventoryAlertsView.as_view(), name="inventory-alerts"),
    path("health/", StockHealthView.as_view(), name="inventory-health"),
    path("reports/<str:report_type>/", InventoryReportsView.as_view(), name="inventory-reports"),
    path("", include(router.urls)),
]
