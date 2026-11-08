from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import (
    IngredientViewSet,
    InventoryVarianceReportView,
    LowStockAlertsView,
    PurchaseOrderViewSet,
    RecipeViewSet,
    StockTransactionViewSet,
    SupplierViewSet,
    WastageLogViewSet,
)

app_name = "inventory"

router = DefaultRouter()
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"ingredients", IngredientViewSet, basename="ingredient")
router.register(r"recipes", RecipeViewSet, basename="recipe")
router.register(r"purchases", PurchaseOrderViewSet, basename="purchase")
router.register(r"wastage", WastageLogViewSet, basename="wastage")
router.register(r"transactions", StockTransactionViewSet, basename="transaction")

urlpatterns = [
    path("reports/low-stock/", LowStockAlertsView.as_view(), name="low-stock-alerts"),
    path(
        "reports/variance/", InventoryVarianceReportView.as_view(), name="inventory-variance-report"
    ),
    path("", include(router.urls)),
]
