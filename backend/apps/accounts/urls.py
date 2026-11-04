from django.urls import path

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
