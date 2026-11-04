import secrets
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import Http404

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.core.exceptions import BusinessRuleError
from apps.rbac.constants import Role
from apps.tenants.models import Branch

User = get_user_model()


def _role_not_allowed(message: str, **details: Any) -> BusinessRuleError:
    return BusinessRuleError("ROLE_NOT_ALLOWED", message, status_code=403, details=details)


def validate_role_hierarchy(caller_role: str, target_role: str) -> None:
    """Enforces that a staff member cannot grant or manage a role equal to or higher than their own.

    Owners and Platform Admins can assign any tenant role.
    Branch Managers cannot create/assign OWNER or higher roles.
    """
    if caller_role in (Role.PLATFORM_ADMIN, Role.OWNER):
        return

    caller_rank = Role.HIERARCHY.get(caller_role, 0)
    target_rank = Role.HIERARCHY.get(target_role, 0)

    if target_rank >= caller_rank:
        raise _role_not_allowed(
            f"You cannot assign or manage role '{target_role}' which is equal to or higher "
            f"than your role '{caller_role}'.",
            caller_role=caller_role,
            target_role=target_role,
        )


def _actor_branch_ids(actor_membership: Membership | None) -> set[str] | None:
    """Branch ids the acting member is restricted to, or None when tenant-wide."""
    if actor_membership is None:
        return None
    ids = {str(b) for b in actor_membership.branches.values_list("id", flat=True)}
    return ids or None


def assert_target_in_actor_scope(actor_membership: Membership | None, target: Membership) -> None:
    """A branch-restricted actor can only see staff who share at least one of their branches."""
    scope = _actor_branch_ids(actor_membership)
    if scope is None:
        return
    target_ids = {str(b) for b in target.branches.values_list("id", flat=True)}
    if not (scope & target_ids):
        raise Http404("Staff member not found.")


def _validate_branch_assignment(
    tenant: Any,
    branch_ids: list[Any],
    actor_membership: Membership | None,
) -> list[Branch]:
    branches = list(Branch.objects.filter(tenant=tenant, id__in=branch_ids))
    if len(branches) != len(set(branch_ids)):
        from rest_framework.exceptions import ValidationError

        raise ValidationError(
            {"branch_ids": "One or more branch IDs are invalid or belong to another tenant."},
            code="does_not_exist",
        )
    scope = _actor_branch_ids(actor_membership)
    if scope is not None:
        outside = [str(b.id) for b in branches if str(b.id) not in scope]
        if outside or not branches:
            raise _role_not_allowed(
                "You can only assign staff to branches you manage.",
                branch_ids=outside,
            )
    return branches


def _assert_not_last_owner(membership: Membership) -> None:
    """The last active OWNER of a tenant can be neither deactivated nor demoted."""
    if membership.role != Role.OWNER or not membership.is_active:
        return
    others = (
        Membership.objects.filter(tenant=membership.tenant, role=Role.OWNER, is_active=True)
        .exclude(pk=membership.pk)
        .count()
    )
    if others == 0:
        raise BusinessRuleError(
            "LAST_OWNER",
            "This is the only active owner. Make someone else an owner first.",
            status_code=409,
            details={"membership_id": str(membership.id)},
        )


def issue_temporary_password(user: Any) -> str:
    """Set a fresh random password that must be changed at next login; returned once."""
    temp_password = secrets.token_urlsafe(12)
    user.set_password(temp_password)
    user.must_change_password = True
    user.save()
    return temp_password


def revoke_all_sessions(user: Any) -> None:
    """Blacklist every outstanding refresh token for the user."""
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    for tok in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=tok)


@transaction.atomic
def create_staff_member(
    tenant: Any,
    actor: Any,
    actor_role: str,
    email: str,
    full_name: str,
    role: str,
    phone: str = "",
    password: str = "",
    branch_ids: list[Any] | None = None,
    is_active: bool = True,
    request: Any | None = None,
    actor_membership: Membership | None = None,
) -> tuple[Membership, str]:
    """Create or attach a staff member to the tenant with assigned role and branches.

    Returns (membership, temporary_password). For a user who already has an account
    (e.g. works at another business) the existing password is NEVER touched and the
    temporary password is an empty string.
    """
    validate_role_hierarchy(actor_role, role)

    normalized_email = email.strip().lower()
    user, created = User.objects.get_or_create(
        email=normalized_email,
        defaults={
            "full_name": full_name,
            "phone": phone,
            "is_active": True,
        },
    )

    if not created and getattr(user, "is_platform_admin", False):
        raise _role_not_allowed("This account cannot be added as staff.")

    temp_password = ""
    if created:
        if password:
            user.set_password(password)
            user.must_change_password = True
            user.save()
            temp_password = password
        else:
            temp_password = issue_temporary_password(user)

    branches: list[Branch] | None = None
    if branch_ids is not None:
        branches = _validate_branch_assignment(tenant, branch_ids, actor_membership)
    elif _actor_branch_ids(actor_membership) is not None:
        raise _role_not_allowed("You can only assign staff to branches you manage.")

    membership, mem_created = Membership.objects.get_or_create(
        user=user,
        tenant=tenant,
        defaults={"role": role, "is_active": is_active},
    )

    if not mem_created:
        validate_role_hierarchy(actor_role, membership.role)
        _assert_not_last_owner_on_change(membership, role, is_active)
        membership.role = role
        membership.is_active = is_active
        membership.save()

    if branches is not None:
        membership.branches.set(branches)

    log_audit_event(
        action="staff.create" if mem_created else "staff.update",
        entity_type="Membership",
        entity_id=str(membership.id),
        actor=actor,
        tenant=tenant,
        after_state={
            "user_id": str(user.id),
            "email": user.email,
            "role": role,
            "is_active": is_active,
            "branch_ids": [str(b.id) for b in membership.branches.all()],
        },
        request=request,
    )

    return membership, temp_password


def _assert_not_last_owner_on_change(
    membership: Membership, new_role: str | None, new_active: bool | None
) -> None:
    demoting = new_role is not None and new_role != Role.OWNER
    deactivating = new_active is False
    if demoting or deactivating:
        _assert_not_last_owner(membership)


@transaction.atomic
def update_staff_member(
    membership: Membership,
    actor: Any,
    actor_role: str,
    role: str | None = None,
    branch_ids: list[Any] | None = None,
    is_active: bool | None = None,
    request: Any | None = None,
    actor_membership: Membership | None = None,
) -> Membership:
    """Update role, branch assignments, or active status of a staff member."""
    validate_role_hierarchy(actor_role, membership.role)
    assert_target_in_actor_scope(actor_membership, membership)

    is_self = getattr(actor, "id", None) is not None and membership.user_id == actor.id
    if is_self and (
        (role is not None and role != membership.role)
        or (is_active is not None and is_active != membership.is_active)
    ):
        raise _role_not_allowed("You cannot change your own role or active status.")

    before_state = {
        "role": membership.role,
        "is_active": membership.is_active,
        "branch_ids": [str(b.id) for b in membership.branches.all()],
    }

    if role is not None:
        validate_role_hierarchy(actor_role, role)

    _assert_not_last_owner_on_change(membership, role, is_active)

    branches: list[Branch] | None = None
    if branch_ids is not None:
        branches = _validate_branch_assignment(membership.tenant, branch_ids, actor_membership)

    if role is not None:
        membership.role = role
    if is_active is not None:
        membership.is_active = is_active
    membership.save()

    if branches is not None:
        membership.branches.set(branches)

    log_audit_event(
        action="staff.update",
        entity_type="Membership",
        entity_id=str(membership.id),
        actor=actor,
        tenant=membership.tenant,
        before_state=before_state,
        after_state={
            "role": membership.role,
            "is_active": membership.is_active,
            "branch_ids": [str(b.id) for b in membership.branches.all()],
        },
        request=request,
    )

    return membership


@transaction.atomic
def reset_staff_password(
    membership: Membership,
    actor: Any,
    actor_role: str,
    request: Any | None = None,
    actor_membership: Membership | None = None,
) -> str:
    """Issue a new one-time temporary password for a staff member; returned once."""
    validate_role_hierarchy(actor_role, membership.role)
    assert_target_in_actor_scope(actor_membership, membership)

    if getattr(actor, "id", None) is not None and membership.user_id == actor.id:
        raise _role_not_allowed("Use 'Change password' to change your own password.")

    other_tenants = (
        Membership.objects.filter(user=membership.user, is_active=True)
        .exclude(tenant=membership.tenant)
        .exists()
    )
    if other_tenants and not getattr(actor, "is_platform_admin", False):
        raise _role_not_allowed(
            "This person also works at another business, so their password can only be "
            "reset by platform support."
        )

    temp_password = issue_temporary_password(membership.user)
    revoke_all_sessions(membership.user)

    log_audit_event(
        action="staff.reset_password",
        entity_type="Membership",
        entity_id=str(membership.id),
        actor=actor,
        tenant=membership.tenant,
        after_state={"user_id": str(membership.user_id), "must_change_password": True},
        request=request,
    )
    return temp_password
