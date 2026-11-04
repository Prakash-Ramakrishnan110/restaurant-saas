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
    business_type: str = Tenant.BusinessType.RESTAURANT,
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
        business_type=business_type,
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
    owner_user, owner_created = User.objects.get_or_create(
        email=normalized_owner_email,
        defaults={
            "full_name": owner_full_name or f"{name} Owner",
            "is_active": True,
        },
    )
    # A brand-new owner always gets a password that must be changed on first login.
    # An existing account (owner of another business) is never touched.
    # The plain password lives only on this transient attribute so the API can show it once.
    owner_user.temporary_password = ""  # type: ignore[attr-defined]
    if owner_created:
        if owner_password:
            owner_user.set_password(owner_password)
            owner_user.must_change_password = True
            owner_user.save()
            owner_user.temporary_password = owner_password  # type: ignore[attr-defined]
        else:
            from apps.accounts.staff_service import issue_temporary_password

            owner_user.temporary_password = issue_temporary_password(owner_user)  # type: ignore[attr-defined]

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
    venue_profile: str | None = None,
    operating_hours: dict[str, Any] | None = None,
    actor: Any | None = None,
    request: Any | None = None,
) -> Branch:
    """Create a new branch for the tenant and apply default venue capability presets."""
    from apps.subscriptions.services import enforce_limit
    from apps.venues.presets import suggest_venue_profile
    from apps.venues.services import apply_preset

    if not venue_profile:
        venue_profile = suggest_venue_profile(tenant.business_type)

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
            "service_area",
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


@transaction.atomic
def update_business_profile(
    tenant: Tenant,
    data: dict[str, Any],
    actor: Any | None = None,
    request: Any | None = None,
) -> Tenant:
    """Updates the active tenant's profile and business settings with audit logging.

    Fields on tenant: name, business_type, email, phone, timezone, address.
    Fields on business_settings: invoice_prefix, logo_url, primary_color, tax_mode.
    Read-only / immutable via this endpoint: id, slug, status, subscription_status, currency.
    """
    settings, _ = BusinessSettings.objects.get_or_create(tenant=tenant)

    before_state = {
        "name": tenant.name,
        "business_type": tenant.business_type,
        "email": tenant.email,
        "phone": tenant.phone,
        "timezone": tenant.timezone,
        "address": tenant.address,
        "invoice_prefix": settings.invoice_prefix,
        "logo_url": settings.logo_url,
        "primary_color": settings.primary_color,
        "tax_mode": settings.tax_mode,
    }

    # Settings fields can be passed directly or under business_settings
    settings_data = data.get("business_settings", {})
    if not isinstance(settings_data, dict):
        settings_data = {}

    for field in ["invoice_prefix", "logo_url", "primary_color", "tax_mode"]:
        if field in data and data[field] is not None:
            setattr(settings, field, data[field])
        elif field in settings_data and settings_data[field] is not None:
            setattr(settings, field, settings_data[field])

    for field in ["name", "business_type", "email", "phone", "timezone", "address"]:
        if field in data and data[field] is not None:
            setattr(tenant, field, data[field])

    tenant.save()
    settings.save()

    after_state = {
        "name": tenant.name,
        "business_type": tenant.business_type,
        "email": tenant.email,
        "phone": tenant.phone,
        "timezone": tenant.timezone,
        "address": tenant.address,
        "invoice_prefix": settings.invoice_prefix,
        "logo_url": settings.logo_url,
        "primary_color": settings.primary_color,
        "tax_mode": settings.tax_mode,
    }

    log_audit_event(
        action="business.update",
        entity_type="Tenant",
        entity_id=str(tenant.id),
        tenant=tenant,
        actor=actor,
        request=request,
        before_state=before_state,
        after_state=after_state,
    )

    return tenant


def get_onboarding_status(tenant: Tenant) -> dict[str, Any]:
    """Compute the onboarding wizard completion checklist for a tenant."""

    from apps.accounts.models import Membership
    from apps.venues.models import (
        BranchCapabilities,
        DiningTable,
        QRCode,
        ServiceArea,
        TokenCounter,
    )
    from apps.venues.presets import suggest_venue_profile

    # 1. Business Profile
    has_profile = bool(tenant.name and (tenant.email or tenant.phone) and tenant.timezone)

    # 2. First Branch
    branches = Branch.objects.filter(tenant=tenant, is_active=True)
    first_branch = branches.first()
    has_first_branch = first_branch is not None

    # 3. Venue Profile Chosen & Capabilities
    has_venue_profile = False
    uses_tables = True
    if first_branch:
        capabilities = BranchCapabilities.objects.filter(branch=first_branch).first()
        has_venue_profile = bool(first_branch.venue_profile and capabilities is not None)
        if capabilities:
            uses_tables = capabilities.uses_tables

    # 4. Service Areas
    service_areas_count = ServiceArea.objects.filter(tenant=tenant).count()
    has_service_areas = service_areas_count >= 1

    # 5. Tables or Counters
    tables_count = DiningTable.objects.filter(tenant=tenant).count()
    counters_count = TokenCounter.objects.filter(tenant=tenant).count()
    if uses_tables:
        has_tables_or_counters = tables_count >= 1
    else:
        # Counter/takeaway venue without tables
        has_tables_or_counters = counters_count >= 1 or has_service_areas

    # 6. QR Codes
    qr_codes_count = QRCode.objects.filter(tenant=tenant, is_active=True).count()
    has_qr_codes = qr_codes_count >= 1

    # 7. Staff Invited (At least 2 memberships: Owner + 1 staff)
    staff_count = Membership.objects.filter(tenant=tenant, is_active=True).count()
    has_staff_invited = staff_count >= 2

    steps = {
        "business_profile": has_profile,
        "first_branch": has_first_branch,
        "venue_profile_chosen": has_venue_profile,
        "service_areas": has_service_areas,
        "tables_or_counters": has_tables_or_counters,
        "qr_codes": has_qr_codes,
        "staff_invited": has_staff_invited,
    }

    next_step = next((k for k, v in steps.items() if not v), None)
    is_complete = next_step is None
    suggested_profile = suggest_venue_profile(tenant.business_type)

    return {
        "is_complete": is_complete,
        "next_step": next_step,
        "steps": steps,
        "details": {
            "tenant_id": str(tenant.id),
            "tenant_name": tenant.name,
            "business_type": tenant.business_type,
            "suggested_venue_profile": suggested_profile,
            "branch_count": branches.count(),
            "service_area_count": service_areas_count,
            "table_count": tables_count,
            "token_counter_count": counters_count,
            "qr_code_count": qr_codes_count,
            "staff_count": staff_count,
        },
    }


@transaction.atomic
def reset_owner_passwords(
    tenant: Tenant, actor: Any | None = None, request: Any | None = None
) -> list[dict[str, str]]:
    """Platform support: issue new one-time passwords for every active OWNER of a tenant."""
    from apps.accounts.staff_service import issue_temporary_password, revoke_all_sessions

    results: list[dict[str, str]] = []
    owners = Membership.objects.filter(
        tenant=tenant, role=Role.OWNER, is_active=True
    ).select_related("user")
    for membership in owners:
        temp_password = issue_temporary_password(membership.user)
        revoke_all_sessions(membership.user)
        results.append({"email": membership.user.email, "temporary_password": temp_password})
        log_audit_event(
            action="tenant.reset_owner_password",
            entity_type="Membership",
            entity_id=str(membership.id),
            actor=actor,
            tenant=tenant,
            after_state={"user_id": str(membership.user_id), "must_change_password": True},
            request=request,
        )
    return results
