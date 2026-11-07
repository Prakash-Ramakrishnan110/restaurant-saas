from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.orders.views import (
    BillingViewSet,
    InvoiceViewSet,
    KDSViewSet,
    OrderViewSet,
    ServiceRequestViewSet,
    TodayReportView,
)

router = DefaultRouter()
router.register(r"kds", KDSViewSet, basename="kds")
router.register(r"service-requests", ServiceRequestViewSet, basename="service-requests")
router.register(r"billing", BillingViewSet, basename="billing")
router.register(r"invoices", InvoiceViewSet, basename="invoices")
router.register(r"", OrderViewSet, basename="orders")

urlpatterns = [
    path("", include(router.urls)),
]
