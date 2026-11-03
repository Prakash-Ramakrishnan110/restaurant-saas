from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant

User = get_user_model()


@transaction.atomic
def create_tenant_with_defaults(
    name: str,
    slug: str | None = None,
    email: str = "",
    phone: str = "",
    address: str = "",
    timezone: str = "Asia/Kolkata",
    currency: str = "INR",
    owner_email: str = "",
    owner_full_name: str = "",
    owner_password: str = "",
    actor: Any | None = None,
    request: Any | None = None,
) -> tuple[Tenant, Any, Membership]:
    """Platform administrator provisioning of a new Tenant.

    Automatically creates:
    1. Tenant record (status=ACTIVE)
    2. Default BusinessSettings (tax_mode=INCLUSIVE, invoice_prefix=INV-)
    3. Trial Subscription (status=TRIAL)
    4. First OWNER User and active Membership.
    5. Immutable AuditLog entry.
    """
    if not slug:
        slug = slugify(name)

    tenant = Tenant.objects.create(
        name=name,
        slug=slug,
        status=Tenant.Status.ACTIVE,
        email=email,
        phone=phone,
        address=address,
        timezone=timezone,
        currency=currency,
    )

    # 2. Default BusinessSettings
    BusinessSettings.objects.create(
        tenant=tenant,
        tax_mode=BusinessSettings.TaxMode.INCLUSIVE,
        invoice_prefix="INV-",
    )

    # 3. Default Trial Subscription
    Subscription.objects.create(
        tenant=tenant,
        status=SubscriptionStatus.TRIAL,
    )

    # 4. First Owner User and Membership
    normalized_owner_email = owner_email.strip().lower()
    owner_user, _ = User.objects.get_or_create(
        email=normalized_owner_email,
        defaults={
            "full_name": owner_full_name or f"{name} Owner",
            "is_active": True,
        },
    )
    if owner_password:
        owner_user.set_password(owner_password)
        owner_user.save()

    membership = Membership.objects.create(
        user=owner_user,
        tenant=tenant,
        role=Role.OWNER,
        is_active=True,
    )

    # 5. Audit Log
    log_audit_event(
        action="tenant.create",
        entity_type="Tenant",
        entity_id=str(tenant.id),
        actor=actor,
        tenant=tenant,
        after_state={
            "name": tenant.name,
            "slug": tenant.slug,
            "owner_email": owner_user.email,
        },
        request=request,
    )

    return tenant, owner_user, membership


@transaction.atomic
def suspend_tenant(tenant: Tenant, actor: Any | None = None, request: Any | None = None) -> Tenant:
    """Suspend tenant and cascade subscription suspension."""
    before_status = tenant.status
    tenant.status = Tenant.Status.SUSPENDED
    tenant.save(update_fields=["status", "updated_at"])

    # Update subscription
    if hasattr(tenant, "subscription"):
        tenant.subscription.status = SubscriptionStatus.SUSPENDED
        tenant.subscription.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="tenant.suspend",
        entity_type="Tenant",
        entity_id=str(tenant.id),
        actor=actor,
        tenant=tenant,
        before_state={"status": before_status},
        after_state={"status": Tenant.Status.SUSPENDED},
        request=request,
    )
    return tenant


@transaction.atomic
def activate_tenant(tenant: Tenant, actor: Any | None = None, request: Any | None = None) -> Tenant:
    """Activate tenant and reinstate subscription."""
    before_status = tenant.status
    tenant.status = Tenant.Status.ACTIVE
    tenant.save(update_fields=["status", "updated_at"])

    if hasattr(tenant, "subscription"):
        tenant.subscription.status = SubscriptionStatus.ACTIVE
        tenant.subscription.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="tenant.activate",
        entity_type="Tenant",
        entity_id=str(tenant.id),
        actor=actor,
        tenant=tenant,
        before_state={"status": before_status},
        after_state={"status": Tenant.Status.ACTIVE},
        request=request,
    )
    return tenant


@transaction.atomic
def create_branch(
    tenant: Tenant,
    name: str,
    address: str = "",
    phone: str = "",
    venue_profile: str = Branch.VenueProfile.CASUAL_DINING,
    operating_hours: dict[str, Any] | None = None,
    actor: Any | None = None,
    request: Any | None = None,
) -> Branch:
    """Create a new branch for the tenant and apply default venue capability presets."""
    from apps.subscriptions.services import enforce_limit
    from apps.venues.services import apply_preset

    current_branches = Branch.objects.filter(tenant=tenant).count()
    enforce_limit(tenant, "max_branches", current_branches)

    branch = Branch.objects.create(
        tenant=tenant,
        name=name,
        address=address,
        phone=phone,
        venue_profile=venue_profile,
        is_active=True,
        operating_hours=operating_hours or {},
    )

    # Apply default capabilities matching venue profile
    apply_preset(branch, profile=venue_profile, actor=actor, request=request)

    log_audit_event(
        action="branch.create",
        entity_type="Branch",
        entity_id=str(branch.id),
        actor=actor,
        tenant=tenant,
        after_state={
            "name": branch.name,
            "address": branch.address,
            "phone": branch.phone,
            "venue_profile": branch.venue_profile,
        },
        request=request,
    )
    return branch


@transaction.atomic
def update_branch(
    branch: Branch,
    actor: Any | None = None,
    request: Any | None = None,
    **kwargs: Any,
) -> Branch:
    """Update branch attributes and log audit entry."""
    before_state = {
        "name": branch.name,
        "address": branch.address,
        "phone": branch.phone,
        "is_active": branch.is_active,
    }

    for key, value in kwargs.items():
        setattr(branch, key, value)
    branch.save()

    log_audit_event(
        action="branch.update",
        entity_type="Branch",
        entity_id=str(branch.id),
        actor=actor,
        tenant=branch.tenant,
        before_state=before_state,
        after_state={
            "name": branch.name,
            "address": branch.address,
            "phone": branch.phone,
            "is_active": branch.is_active,
        },
        request=request,
    )
    return branch


@transaction.atomic
def delete_branch(branch: Branch, actor: Any | None = None, request: Any | None = None) -> None:
    """Deactivate or delete a branch."""
    branch_id = str(branch.id)
    tenant = branch.tenant
    branch_name = branch.name

    branch.is_active = False
    branch.save(update_fields=["is_active", "updated_at"])

    log_audit_event(
        action="branch.deactivate",
        entity_type="Branch",
        entity_id=branch_id,
        actor=actor,
        tenant=tenant,
        before_state={"name": branch_name, "is_active": True},
        after_state={"name": branch_name, "is_active": False},
        request=request,
    )


def get_public_qr_code(token: str) -> Any | None:
    """Resolve an unauthenticated public QR token across tenants.

    Approved unscoped lookup for public diner entry.
    """
    from apps.venues.models import QRCode

    return (
        QRCode.unscoped.select_related(
            "tenant",
            "branch__capabilities",
            "table__section__service_area",
        )
        .filter(public_token=token, is_active=True)
        .first()
    )


def get_idle_sessions(cutoff: Any) -> list[Any]:
    """Retrieve abandoned open table sessions across all tenants for background reaper.

    Approved unscoped lookup for platform/Celery background tasks.
    """
    from apps.venues.models import TableSession

    return list(
        TableSession.unscoped.select_related("tenant", "table").filter(
            status="OPEN",
            last_activity_at__lt=cutoff,
        )
    )
