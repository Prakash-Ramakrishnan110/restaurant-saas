from typing import Any

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.utils import extend_schema
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from apps.core.views import HealthCheckView
from apps.orders.views import (
    CustomerViewSet,
    ExceptionsReportView,
    InvoiceViewSet,
    OrdersDelayReportView,
    OutletComparisonReportView,
    RangeReportView,
    StaffReportView,
    TodayReportView,
)


class HealthCheckNoSlashView(HealthCheckView):
    @extend_schema(exclude=True)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


invoice_router = DefaultRouter()
invoice_router.register(r"", InvoiceViewSet, basename="invoices-standalone")

customer_router = DefaultRouter()
customer_router.register(r"", CustomerViewSet, basename="customers-standalone")

api_v1_patterns: list[Any] = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.tenants.urls")),
    path("", include("apps.venues.urls")),
    path("", include("apps.subscriptions.urls")),
    path("subscriptions/", include("apps.subscriptions.urls")),
    path("menu/", include("apps.menu.urls")),
    path("orders/", include("apps.orders.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("reports/today/", TodayReportView.as_view(), name="reports-today"),
    path("reports/range/", RangeReportView.as_view(), name="reports-range"),
    path("reports/exceptions/", ExceptionsReportView.as_view(), name="reports-exceptions"),
    path("reports/staff/", StaffReportView.as_view(), name="reports-staff"),
    path("reports/outlets/", OutletComparisonReportView.as_view(), name="reports-outlets"),
    path("reports/orders-delay/", OrdersDelayReportView.as_view(), name="reports-orders-delay"),
    path("customers/", include(customer_router.urls)),
    path("invoices/", include(invoice_router.urls)),
    path("audit-logs/", include("apps.audit.urls")),
]

urlpatterns = [
    # Health check: both return 200 OK directly, but OpenAPI only includes /health/
    path("health", HealthCheckNoSlashView.as_view(), name="health-check"),
    path("health/", HealthCheckView.as_view(), name="health-check-slash"),
    # Django Admin
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/", include(api_v1_patterns)),
    # OpenAPI Schema & Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(f"/{settings.MEDIA_URL.strip('/')}/", document_root=settings.MEDIA_ROOT)
