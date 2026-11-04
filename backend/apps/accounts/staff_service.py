from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.rbac.constants import Role
from apps.tenants.models import Branch

User = get_user_model()


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
        raise PermissionDenied(
            f"You cannot assign or manage role '{target_role}' which is equal to or higher than your role '{caller_role}'."
        )


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
) -> tuple[Membership, str]:
    """Create or attach a staff member to the tenant with assigned role and branches."""
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

    if not created:
        if full_name:
            user.full_name = full_name
        if phone:
            user.phone = phone
        user.save()

    import secrets

    if not password:
        temp_password = secrets.token_urlsafe(12)
        user.set_password(temp_password)
        user.must_change_password = True
        user.save()
    else:
        user.set_password(password)
        user.must_change_password = True
        user.save()
        temp_password = password

    # Check if membership already exists for this tenant
    membership, mem_created = Membership.objects.get_or_create(
        user=user,
        tenant=tenant,
        defaults={
            "role": role,
            "is_active": is_active,
        },
    )

    if not mem_created:
        validate_role_hierarchy(actor_role, membership.role)
        membership.role = role
        membership.is_active = is_active
        membership.save()

    # Assign branches
    if branch_ids is not None:
        valid_branches = Branch.objects.filter(tenant=tenant, id__in=branch_ids)
        if len(valid_branches) != len(branch_ids):
            raise ValidationError(
                {"branch_ids": "One or more branch IDs are invalid or belong to another tenant."}
            )
        membership.branches.set(valid_branches)

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


@transaction.atomic
def update_staff_member(
    membership: Membership,
    actor: Any,
    actor_role: str,
    role: str | None = None,
    branch_ids: list[Any] | None = None,
    is_active: bool | None = None,
    request: Any | None = None,
) -> Membership:
    """Update role, branch assignments, or active status of a staff member."""
    validate_role_hierarchy(actor_role, membership.role)

    before_state = {
        "role": membership.role,
        "is_active": membership.is_active,
        "branch_ids": [str(b.id) for b in membership.branches.all()],
    }

    if role is not None:
        validate_role_hierarchy(actor_role, role)
        membership.role = role

    if is_active is not None:
        membership.is_active = is_active

    membership.save()

    if branch_ids is not None:
        valid_branches = Branch.objects.filter(tenant=membership.tenant, id__in=branch_ids)
        if len(valid_branches) != len(branch_ids):
            raise ValidationError(
                {"branch_ids": "One or more branch IDs are invalid or belong to another tenant."}
            )
        membership.branches.set(valid_branches)

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
