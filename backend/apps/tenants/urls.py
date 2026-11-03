from django.urls import path

from apps.tenants.views import BranchViewSet, TenantViewSet

urlpatterns = [
    # Tenant Management (Platform Admin)
    path(
        "tenants/",
        TenantViewSet.as_view({"get": "list", "post": "create"}),
        name="tenant-list-create",
    ),
    path(
        "tenants/<uuid:pk>/",
        TenantViewSet.as_view({"get": "retrieve"}),
        name="tenant-detail",
    ),
    path(
        "tenants/<uuid:pk>/suspend/",
        TenantViewSet.as_view({"post": "suspend"}),
        name="tenant-suspend",
    ),
    path(
        "tenants/<uuid:pk>/activate/",
        TenantViewSet.as_view({"post": "activate"}),
        name="tenant-activate",
    ),
    # Branch Management (Tenant scoped)
    path(
        "branches/",
        BranchViewSet.as_view({"get": "list", "post": "create"}),
        name="branch-list-create",
    ),
    path(
        "branches/<uuid:pk>/",
        BranchViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="branch-detail",
    ),
]
