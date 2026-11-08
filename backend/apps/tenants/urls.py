from django.urls import path

from apps.tenants.views import (
    BranchViewSet,
    BusinessLogoView,
    BusinessProfileView,
    OnboardingStatusView,
    PlatformCustomerCreateView,
    PlatformSummaryView,
    TenantViewSet,
)

urlpatterns = [
    # Platform Summary (Platform Admin)
    path(
        "platform/summary/",
        PlatformSummaryView.as_view(),
        name="platform-summary",
    ),
    # Platform Provisioning New Customer Wizard
    path(
        "platform/customers/",
        PlatformCustomerCreateView.as_view(),
        name="platform-customer-create",
    ),
    # Business Profile & Logo (Active Tenant)
    path(
        "business/",
        BusinessProfileView.as_view(),
        name="business-profile",
    ),
    path(
        "business/logo/",
        BusinessLogoView.as_view(),
        name="business-logo",
    ),
    # Onboarding Status
    path(
        "onboarding/status/",
        OnboardingStatusView.as_view(),
        name="onboarding-status",
    ),
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
        "tenants/<uuid:pk>/reset-owner-password/",
        TenantViewSet.as_view({"post": "reset_owner_password"}),
        name="tenant-reset-owner-password",
    ),
    path(
        "tenants/<uuid:pk>/activate/",
        TenantViewSet.as_view({"post": "activate"}),
        name="tenant-activate",
    ),
    path(
        "tenants/<uuid:pk>/extend-trial/",
        TenantViewSet.as_view({"post": "extend_trial"}),
        name="tenant-extend-trial",
    ),
    path(
        "tenants/<uuid:pk>/change-plan/",
        TenantViewSet.as_view({"post": "change_plan"}),
        name="tenant-change-plan",
    ),
    path(
        "tenants/<uuid:pk>/notes/",
        TenantViewSet.as_view({"post": "add_note"}),
        name="tenant-add-note",
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
