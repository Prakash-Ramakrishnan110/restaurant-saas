from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.orders.public_views import (
    PublicOrderFeedbackView,
    PublicOrderTrackerView,
    PublicQRMenuView,
    PublicQROrderCreateView,
    PublicQRReorderPreviewView,
    PublicQRServiceRequestView,
)
from apps.venues.views import (
    BranchCapabilitiesView,
    DiningTableViewSet,
    LayoutTemplateApplyView,
    LayoutTemplateListView,
    PublicQRDetailView,
    PublicQROpenSessionView,
    QRCodeAnalyticsView,
    QRCodeSheetDataView,
    QRCodeViewSet,
    SectionViewSet,
    ServiceAreaViewSet,
    StaffSectionAssignmentViewSet,
    TableGroupViewSet,
    TableSessionViewSet,
    VenuePresetsView,
)

router = DefaultRouter()
router.register(r"service-areas", ServiceAreaViewSet, basename="service-area")
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"tables", DiningTableViewSet, basename="dining-table")
router.register(r"table-groups", TableGroupViewSet, basename="table-group")
router.register(r"table-sessions", TableSessionViewSet, basename="table-session")
router.register(r"sessions", TableSessionViewSet, basename="session-alias")
router.register(r"staff-assignments", StaffSectionAssignmentViewSet, basename="staff-assignment")
router.register(r"qr-codes", QRCodeViewSet, basename="qr-code")

urlpatterns = [
    path("venues/presets/", VenuePresetsView.as_view(), name="venue-presets"),
    path("layout-templates/", LayoutTemplateListView.as_view(), name="layout-template-list"),
    path(
        "branches/<uuid:branch_id>/layout-templates/<str:key>/apply/",
        LayoutTemplateApplyView.as_view(),
        name="layout-template-apply",
    ),
    path("qr-codes/sheet-data/", QRCodeSheetDataView.as_view(), name="qr-sheet-data"),
    path("qr-codes/analytics/", QRCodeAnalyticsView.as_view(), name="qr-analytics"),
    path(
        "branches/<uuid:branch_id>/capabilities/",
        BranchCapabilitiesView.as_view(),
        name="branch-capabilities",
    ),
    path(
        "public/qr/<str:token>/",
        PublicQRDetailView.as_view(),
        name="public-qr-detail",
    ),
    path(
        "public/qr/<str:token>/session/",
        PublicQROpenSessionView.as_view(),
        name="public-qr-session",
    ),
    path(
        "public/qr/<str:token>/menu/",
        PublicQRMenuView.as_view(),
        name="public-qr-menu",
    ),
    path(
        "public/qr/<str:token>/orders/",
        PublicQROrderCreateView.as_view(),
        name="public-qr-orders",
    ),
    path(
        "public/qr/<str:token>/reorder-preview/",
        PublicQRReorderPreviewView.as_view(),
        name="public-qr-reorder-preview",
    ),
    path(
        "public/qr/<str:token>/service-requests/",
        PublicQRServiceRequestView.as_view(),
        name="public-qr-service-requests",
    ),
    path(
        "public/orders/<str:tracking_token>/",
        PublicOrderTrackerView.as_view(),
        name="public-order-tracker",
    ),
    path(
        "public/orders/<str:tracking_token>/feedback/",
        PublicOrderFeedbackView.as_view(),
        name="public-order-feedback",
    ),
    path("", include(router.urls)),
]
