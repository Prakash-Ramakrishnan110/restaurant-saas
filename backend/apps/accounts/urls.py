from django.urls import path

from apps.accounts.native_views import (
    AndroidAppConfigView,
    BranchStaffDevicesView,
    MyDevicesView,
    MyDeviceTestPushView,
    NativeLoginView,
    NativeLogoutView,
    NativeRefreshView,
    RevokeStaffDeviceView,
)
from apps.accounts.views import (
    AuthMeView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    RefreshTokenView,
    StaffViewSet,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshTokenView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("auth/native/login/", NativeLoginView.as_view(), name="auth-native-login"),
    path("auth/native/refresh/", NativeRefreshView.as_view(), name="auth-native-refresh"),
    path("auth/native/logout/", NativeLogoutView.as_view(), name="auth-native-logout"),
    path("devices/me/", MyDevicesView.as_view(), name="devices-me"),
    path("devices/me/test-push/", MyDeviceTestPushView.as_view(), name="devices-me-test-push"),
    path("devices/", BranchStaffDevicesView.as_view(), name="devices-list"),
    path(
        "devices/<uuid:device_id>/revoke/", RevokeStaffDeviceView.as_view(), name="devices-revoke"
    ),
    path("app/android-config/", AndroidAppConfigView.as_view(), name="app-android-config"),
    path(
        "staff/",
        StaffViewSet.as_view({"get": "list", "post": "create"}),
        name="staff-list-create",
    ),
    path(
        "staff/<uuid:pk>/reset-password/",
        StaffViewSet.as_view({"post": "reset_password"}),
        name="staff-reset-password",
    ),
    path(
        "staff/<uuid:pk>/",
        StaffViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="staff-detail",
    ),
]
