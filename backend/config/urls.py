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
from apps.orders.views import InvoiceViewSet, TodayReportView


class HealthCheckNoSlashView(HealthCheckView):
    @extend_schema(exclude=True)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


invoice_router = DefaultRouter()
invoice_router.register(r"", InvoiceViewSet, basename="invoices-standalone")

api_v1_patterns = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.tenants.urls")),
    path("", include("apps.venues.urls")),
    path("", include("apps.subscriptions.urls")),
    path("menu/", include("apps.menu.urls")),
    path("orders/", include("apps.orders.urls")),
    path("reports/today/", TodayReportView.as_view(), name="reports-today"),
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
