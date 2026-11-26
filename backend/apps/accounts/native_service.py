from typing import Any, cast

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import StaffDevice, User
from apps.accounts.services import authenticate_and_login_user
from apps.audit.services import log_audit_event

GENERIC_LOGIN_ERROR = "Invalid email or password."


@transaction.atomic
def native_login(
    email: str,
    password: str,
    device_id: str,
    app_version: str = "",
    device_name: str = "",
    request: Any | None = None,
) -> tuple[User, str, str, StaffDevice]:
    """Authenticate staff for the Android app, enforce NATIVE_ALLOWED_ROLES, and bind device."""
    user, refresh = authenticate_and_login_user(email=email, password=password, request=request)

    if getattr(user, "is_platform_admin", False):
        log_audit_event(
            action="auth.native_login.failure",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            before_state={"reason": "platform_admin_refused"},
            request=request,
        )
        raise AuthenticationFailed(GENERIC_LOGIN_ERROR)

    allowed_roles = set(getattr(settings, "NATIVE_ALLOWED_ROLES", []))
    has_allowed_role = user.memberships.filter(is_active=True, role__in=allowed_roles).exists()
    if not has_allowed_role:
        log_audit_event(
            action="auth.native_login.failure",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            before_state={"reason": "role_not_allowed"},
            request=request,
        )
        raise AuthenticationFailed(GENERIC_LOGIN_ERROR)

    jti = str(refresh.get("jti", ""))
    now = timezone.now()
    device, _ = StaffDevice.objects.update_or_create(
        user=user,
        device_id=device_id,
        defaults={
            "platform": StaffDevice.Platform.ANDROID,
            "device_name": (device_name or "")[:120],
            "app_version": (app_version or "")[:32],
            "current_refresh_jti": jti,
            "last_seen_at": now,
            "revoked_at": None,
            "revoked_reason": "",
        },
    )

    log_audit_event(
        action="auth.native_login.success",
        entity_type="StaffDevice",
        entity_id=str(device.id),
        actor=user,
        after_state={"device_id": device.device_id, "app_version": device.app_version},
        request=request,
    )
    return user, str(refresh.access_token), str(refresh), device


def native_refresh(refresh_token_str: str, request: Any | None = None) -> tuple[str, str]:
    """Rotate native refresh token and detect blacklisted-token reuse."""
    try:
        token = RefreshToken(cast(Any, refresh_token_str))
    except TokenError as exc:
        # Check if this token was previously blacklisted (reuse detection)
        try:
            import jwt as pyjwt

            payload = pyjwt.decode(
                refresh_token_str,
                options={"verify_signature": False, "verify_exp": False},
            )
            jti = str(payload.get("jti", ""))
            user_id = payload.get("user_id")
            if jti and BlacklistedToken.objects.filter(token__jti=jti).exists():
                user_obj = User.objects.filter(id=user_id).first()
                if user_obj:
                    revoke_user_devices(
                        user_obj,
                        reason="Refresh token reuse detected",
                        actor=user_obj,
                        request=request,
                    )
                    log_audit_event(
                        action="auth.native_refresh.reuse_detected",
                        entity_type="User",
                        entity_id=str(user_obj.id),
                        actor=user_obj,
                        before_state={"jti": jti},
                        request=request,
                    )
        except Exception:
            pass
        raise AuthenticationFailed("Invalid or expired refresh token.") from exc

    jti = str(token.get("jti", ""))
    user_id = token.get("user_id")
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user or getattr(user, "is_platform_admin", False):
        raise AuthenticationFailed("Invalid or expired refresh token.")

    with transaction.atomic():
        device = StaffDevice.objects.filter(
            user=user,
            current_refresh_jti=jti,
            revoked_at__isnull=True,
        ).first()
        if not device:
            raise AuthenticationFailed("Device session has been revoked.")

        token.blacklist()
        new_refresh = RefreshToken.for_user(user)
        new_jti = str(new_refresh.get("jti", ""))

        device.current_refresh_jti = new_jti
        device.last_seen_at = timezone.now()
        device.save(update_fields=["current_refresh_jti", "last_seen_at", "updated_at"])

    return str(new_refresh.access_token), str(new_refresh)


@transaction.atomic
def native_logout(
    refresh_token_str: str | None,
    device_id: str = "",
    user: Any | None = None,
    request: Any | None = None,
) -> None:
    """Blacklist refresh token and clear push token on the matching StaffDevice."""
    resolved_user = user
    if refresh_token_str:
        try:
            token = RefreshToken(cast(Any, refresh_token_str))
            if not resolved_user:
                resolved_user = User.objects.filter(id=token.get("user_id")).first()
            token.blacklist()
        except TokenError:
            pass

    if resolved_user and getattr(resolved_user, "is_authenticated", True) and device_id:
        StaffDevice.objects.filter(user=resolved_user, device_id=device_id).update(
            push_token=None,
            current_refresh_jti="",
        )

    log_audit_event(
        action="auth.native_logout",
        entity_type="User",
        entity_id=str(resolved_user.id)
        if resolved_user and getattr(resolved_user, "id", None)
        else "anonymous",
        actor=resolved_user
        if resolved_user and getattr(resolved_user, "is_authenticated", False)
        else None,
        before_state={"device_id": device_id},
        request=request,
    )


def revoke_user_devices(
    user: User,
    reason: str = "Account deactivated or password changed",
    actor: Any | None = None,
    request: Any | None = None,
) -> int:
    """Revoke all active native devices and blacklist all outstanding tokens for a user."""
    now = timezone.now()
    active_devices = StaffDevice.objects.filter(user=user, revoked_at__isnull=True)
    count = active_devices.update(
        revoked_at=now,
        revoked_reason=reason[:255],
        push_token=None,
        current_refresh_jti="",
    )
    for tok in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=tok)

    if count > 0:
        log_audit_event(
            action="device.revoke_all",
            entity_type="User",
            entity_id=str(user.id),
            actor=actor,
            after_state={"revoked_count": count, "reason": reason},
            request=request,
        )
    return count
