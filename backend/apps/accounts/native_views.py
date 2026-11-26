from django.conf import settings
from django.http import Http404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.models import Membership, StaffDevice, User
from apps.accounts.native_serializers import (
    AndroidConfigResponseSerializer,
    NativeLoginRequestSerializer,
    NativeLoginResponseSerializer,
    NativeLogoutRequestSerializer,
    NativeRefreshRequestSerializer,
    NativeRefreshResponseSerializer,
    RevokeDeviceRequestSerializer,
    StaffDevicePublicSerializer,
    StaffDeviceUpsertSerializer,
)
from apps.accounts.native_service import (
    GENERIC_LOGIN_ERROR,
    native_login,
    native_logout,
    native_refresh,
)
from apps.accounts.serializers import MembershipSummarySerializer, UserSerializer
from apps.accounts.throttling import LoginEmailRateThrottle, LoginIPRateThrottle
from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.rbac.constants import Role


class DeviceRegisterRateThrottle(UserRateThrottle):
    scope = "device_register"
    rate = "30/minute"


class TestPushRateThrottle(UserRateThrottle):
    scope = "test_push"
    rate = "3/minute"


class NativeRefreshAnonThrottle(AnonRateThrottle):
    scope = "login_ip"


class NativeLoginView(APIView):
    """Native Android login returning access & refresh in JSON (no cookies)."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginIPRateThrottle, LoginEmailRateThrottle]

    @extend_schema(
        request=NativeLoginRequestSerializer,
        responses={
            200: NativeLoginResponseSerializer,
            400: OpenApiResponse(description="Missing X-Client header or invalid payload"),
            401: OpenApiResponse(description="Invalid credentials or role disallowed"),
            429: OpenApiResponse(description="Rate limit exceeded"),
        },
    )
    def post(self, request: Request) -> Response:
        if request.headers.get("X-Client") != "android-staff":
            return Response(
                {
                    "error": {
                        "code": "INVALID_CLIENT",
                        "message": GENERIC_LOGIN_ERROR,
                        "details": {},
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = NativeLoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        user, access, refresh, device = native_login(
            email=v["email"],
            password=v["password"],
            device_id=v["device_id"],
            app_version=v.get("app_version", ""),
            device_name=v.get("device_name", ""),
            request=request,
        )

        memberships = (
            user.memberships.filter(is_active=True)
            .select_related("tenant")
            .prefetch_related("branches")
        )
        active_tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not active_tenant and memberships.count() == 1:
            first_m = memberships.first()
            active_tenant = first_m.tenant if first_m else None

        return Response(
            {
                "access": access,
                "refresh": refresh,
                "user": UserSerializer(user).data,
                "active_tenant_id": active_tenant.id if active_tenant else None,
                "memberships": MembershipSummarySerializer(memberships, many=True).data,
                "device_id": device.device_id,
            },
            status=status.HTTP_200_OK,
        )


class NativeRefreshView(APIView):
    """Rotate native refresh token (no cookies)."""

    permission_classes = [AllowAny]
    throttle_classes = [NativeRefreshAnonThrottle]

    @extend_schema(
        request=NativeRefreshRequestSerializer,
        responses={200: NativeRefreshResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = NativeRefreshRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        access, new_refresh = native_refresh(
            refresh_token_str=serializer.validated_data["refresh"],
            request=request,
        )
        return Response({"access": access, "refresh": new_refresh}, status=status.HTTP_200_OK)


class NativeLogoutView(APIView):
    """Blacklist native refresh token and clear device push token (no cookies)."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=NativeLogoutRequestSerializer,
        responses={200: OpenApiResponse(description="Logged out")},
    )
    def post(self, request: Request) -> Response:
        serializer = NativeLogoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        native_logout(
            refresh_token_str=serializer.validated_data.get("refresh") or None,
            device_id=serializer.validated_data.get("device_id", ""),
            user=request.user if request.user and request.user.is_authenticated else None,
            request=request,
        )
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class MyDevicesView(APIView):
    """Register/update current user's device or list own active devices (no tokens returned)."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "PUT":
            return [DeviceRegisterRateThrottle()]
        return super().get_throttles()

    @extend_schema(responses={200: StaffDevicePublicSerializer(many=True)})
    def get(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        devices = StaffDevice.objects.filter(
            user=request.user, revoked_at__isnull=True
        ).select_related("user")
        return Response(
            StaffDevicePublicSerializer(devices, many=True).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        request=StaffDeviceUpsertSerializer,
        responses={200: StaffDevicePublicSerializer},
    )
    def put(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        serializer = StaffDeviceUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        defaults: dict[str, object] = {
            "platform": StaffDevice.Platform.ANDROID,
            "last_seen_at": timezone.now(),
        }
        if "device_name" in v:
            defaults["device_name"] = v["device_name"]
        if "app_version" in v:
            defaults["app_version"] = v["app_version"]
        if "push_enabled" in v:
            defaults["push_enabled"] = v["push_enabled"]
        if "push_token" in v:
            defaults["push_token"] = v["push_token"] or None

        device, _ = StaffDevice.objects.update_or_create(
            user=request.user,
            device_id=v["device_id"],
            defaults=defaults,
        )
        return Response(StaffDevicePublicSerializer(device).data, status=status.HTTP_200_OK)


class MyDeviceTestPushView(APIView):
    """Trigger test push to current user's active device (Stage 2 delivers via FCM)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [TestPushRateThrottle]

    @extend_schema(responses={200: OpenApiResponse(description="Test push status")})
    def post(self, request: Request) -> Response:
        return Response(
            {
                "delivered": False,
                "configured": False,
                "message": "Push alerts are not configured yet (Stage 2).",
            },
            status=status.HTTP_200_OK,
        )


def _scoped_branch_devices_queryset(request: Request):
    tenant = getattr(request, "tenant", None) or get_current_tenant()
    if not tenant or not request.user or not request.user.is_authenticated:
        raise BusinessRuleError(
            "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
        )
    membership = Membership.objects.filter(user=request.user, tenant=tenant, is_active=True).first()
    if not membership or membership.role not in {Role.OWNER, Role.BRANCH_MANAGER}:
        raise BusinessRuleError(
            "PERMISSION_DENIED",
            "Only Owners and Branch Managers can manage staff devices.",
            status_code=403,
        )

    allowed_memberships = Membership.objects.filter(tenant=tenant, is_active=True)
    actor_branches = list(membership.branches.values_list("id", flat=True))
    if membership.role == Role.BRANCH_MANAGER and actor_branches:
        allowed_memberships = allowed_memberships.filter(branches__id__in=actor_branches).distinct()

    user_ids = allowed_memberships.values_list("user_id", flat=True)
    return (
        tenant,
        StaffDevice.objects.filter(user_id__in=user_ids, revoked_at__isnull=True).select_related(
            "user"
        ),
    )


class BranchStaffDevicesView(APIView):
    """List active staff phones within the tenant/branch scope (OWNER & BRANCH_MANAGER)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: StaffDevicePublicSerializer(many=True)})
    def get(self, request: Request) -> Response:
        _tenant, qs = _scoped_branch_devices_queryset(request)
        return Response(StaffDevicePublicSerializer(qs, many=True).data, status=status.HTTP_200_OK)


class RevokeStaffDeviceView(APIView):
    """Remote sign-out for a staff phone within tenant/branch scope."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=RevokeDeviceRequestSerializer,
        responses={200: StaffDevicePublicSerializer},
    )
    def post(self, request: Request, device_id: str) -> Response:
        tenant, qs = _scoped_branch_devices_queryset(request)
        device = qs.filter(id=device_id).first()
        if not device:
            raise Http404("Device not found.")

        serializer = RevokeDeviceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]

        before_state = {
            "revoked_at": None,
            "push_enabled": device.push_enabled,
        }
        now = timezone.now()
        if device.current_refresh_jti:
            for tok in OutstandingToken.objects.filter(
                user=device.user, jti=device.current_refresh_jti
            ):
                BlacklistedToken.objects.get_or_create(token=tok)

        device.revoked_at = now
        device.revoked_reason = reason
        device.push_token = None
        device.current_refresh_jti = ""
        device.save(
            update_fields=[
                "revoked_at",
                "revoked_reason",
                "push_token",
                "current_refresh_jti",
                "updated_at",
            ]
        )

        log_audit_event(
            action="device.revoke",
            entity_type="StaffDevice",
            entity_id=str(device.id),
            actor=request.user,
            tenant=tenant,
            before_state=before_state,
            after_state={"revoked_at": now.isoformat(), "reason": reason},
            request=request,
        )

        return Response(StaffDevicePublicSerializer(device).data, status=status.HTTP_200_OK)


class AndroidAppConfigView(APIView):
    """Public minimum/latest Android app version configuration (no-store)."""

    permission_classes = [AllowAny]

    @extend_schema(responses={200: AndroidConfigResponseSerializer})
    def get(self, request: Request) -> Response:
        cfg = getattr(settings, "ANDROID_APP_CONFIG", {})
        resp = Response(
            {
                "minimum_version_code": int(cfg.get("minimum_version_code", 1)),
                "latest_version_code": int(cfg.get("latest_version_code", 1)),
                "download_url": str(cfg.get("download_url", "")),
                "maintenance_message": str(cfg.get("maintenance_message", "")),
            },
            status=status.HTTP_200_OK,
        )
        resp["Cache-Control"] = "no-store"
        return resp
