from typing import Any, cast

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import log_audit_event
from apps.subscriptions.services import is_tenant_allowed

User = get_user_model()


def authenticate_and_login_user(
    email: str,
    password: str,
    request: Any | None = None,
) -> tuple[Any, RefreshToken]:
    """Authenticate credentials, verify tenant standing, record audit trail, and issue JWT tokens.

    Throws generic AuthenticationFailed on invalid credentials to prevent user enumeration.
    """
    normalized_email = (email or "").strip().lower()
    generic_error = "Invalid email or password."

    try:
        user = User.objects.get(email=normalized_email)
    except User.DoesNotExist:
        log_audit_event(
            action="auth.login.failure",
            entity_type="User",
            entity_id=normalized_email,
            before_state={"email": normalized_email, "reason": "user_not_found"},
            request=request,
        )
        raise AuthenticationFailed(generic_error) from None

    if not user.check_password(password) or not user.is_active:
        log_audit_event(
            action="auth.login.failure",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            before_state={"email": normalized_email, "reason": "invalid_password_or_inactive"},
            request=request,
        )
        raise AuthenticationFailed(generic_error) from None

    # Check tenant access for non-platform admins
    if not user.is_platform_admin:
        memberships = user.memberships.filter(is_active=True).select_related(
            "tenant", "tenant__subscription"
        )
        if not memberships.exists():
            log_audit_event(
                action="auth.login.failure",
                entity_type="User",
                entity_id=str(user.id),
                actor=user,
                before_state={"reason": "no_active_memberships"},
                request=request,
            )
            raise AuthenticationFailed(generic_error) from None

        # Check if all tenants are suspended
        allowed_count = sum(1 for m in memberships if is_tenant_allowed(m.tenant))
        if allowed_count == 0:
            log_audit_event(
                action="auth.login.failure",
                entity_type="User",
                entity_id=str(user.id),
                actor=user,
                before_state={"reason": "all_tenants_suspended"},
                request=request,
            )
            raise AuthenticationFailed("Organization account is suspended or inactive.")

    # Record login success audit log
    log_audit_event(
        action="auth.login.success",
        entity_type="User",
        entity_id=str(user.id),
        actor=user,
        request=request,
    )

    refresh = RefreshToken.for_user(user)
    return user, refresh


def refresh_user_tokens(refresh_token_str: str) -> tuple[str, str]:
    """Rotate refresh token: blacklists the old one and generates a new pair.

    Returns (new_access_token, new_refresh_token).
    """
    try:
        token = RefreshToken(cast(Any, refresh_token_str))
        token.blacklist()
        user_id = token.payload.get("user_id")
        user = User.objects.get(id=user_id)
        new_refresh = RefreshToken.for_user(user)
        return str(new_refresh.access_token), str(new_refresh)
    except (TokenError, User.DoesNotExist) as exc:
        raise AuthenticationFailed("Invalid or expired refresh token.") from exc


def logout_user(
    refresh_token_str: str | None, user: Any | None = None, request: Any | None = None
) -> None:
    """Blacklist the refresh token and record audit trail."""
    if refresh_token_str:
        try:
            token = RefreshToken(cast(Any, refresh_token_str))
            token.blacklist()
        except TokenError:
            pass

    log_audit_event(
        action="auth.logout",
        entity_type="User",
        entity_id=str(user.id) if user and getattr(user, "id", None) else "anonymous",
        actor=user if user and getattr(user, "is_authenticated", False) else None,
        request=request,
    )
