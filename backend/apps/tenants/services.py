import io
import uuid
from typing import Any

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils.text import slugify
from PIL import Image

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.core.exceptions import BusinessRuleError
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
    Fields on business_settings: invoice_prefix, logo_url, logo_128_url, primary_color,
    brand_primary_color, legal_name, gstin, registered_address, document_language, receipt_footer_text, tax_mode.
    Read-only / immutable via this endpoint: id, slug, status, subscription_status, currency.
    """
    settings, _ = BusinessSettings.unscoped.get_or_create(tenant=tenant)

    before_state = {
        "name": tenant.name,
        "business_type": tenant.business_type,
        "email": tenant.email,
        "phone": tenant.phone,
        "timezone": tenant.timezone,
        "address": tenant.address,
        "invoice_prefix": settings.invoice_prefix,
        "logo_url": settings.logo_url,
        "logo_128_url": settings.logo_128_url,
        "primary_color": settings.primary_color,
        "brand_primary_color": settings.brand_primary_color,
        "legal_name": settings.legal_name,
        "gstin": settings.gstin,
        "registered_address": settings.registered_address,
        "document_language": settings.document_language,
        "receipt_footer_text": settings.receipt_footer_text,
        "tax_mode": settings.tax_mode,
    }

    # Settings fields can be passed directly or under business_settings
    settings_data = data.get("business_settings", {})
    if not isinstance(settings_data, dict):
        settings_data = {}

    settings_fields = [
        "invoice_prefix",
        "logo_url",
        "logo_128_url",
        "primary_color",
        "brand_primary_color",
        "legal_name",
        "gstin",
        "registered_address",
        "document_language",
        "receipt_footer_text",
        "tax_mode",
    ]

    for field in settings_fields:
        if field in data and data[field] is not None:
            setattr(settings, field, data[field])
        elif field in settings_data and settings_data[field] is not None:
            setattr(settings, field, settings_data[field])

    # Keep primary_color and brand_primary_color in sync
    if "brand_primary_color" in data and data["brand_primary_color"]:
        settings.primary_color = data["brand_primary_color"]
    elif "primary_color" in data and data["primary_color"] and "brand_primary_color" not in data:
        settings.brand_primary_color = data["primary_color"]

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
        "logo_128_url": settings.logo_128_url,
        "primary_color": settings.primary_color,
        "brand_primary_color": settings.brand_primary_color,
        "legal_name": settings.legal_name,
        "gstin": settings.gstin,
        "registered_address": settings.registered_address,
        "document_language": settings.document_language,
        "receipt_footer_text": settings.receipt_footer_text,
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

    has_layout = (
        (has_service_areas and has_tables_or_counters)
        if uses_tables
        else (has_service_areas or counters_count >= 1)
    )

    steps = {
        "business_profile": has_profile,
        "first_branch": has_first_branch,
        "venue_profile_chosen": has_venue_profile,
        "service_areas": has_service_areas,
        "tables_or_counters": has_tables_or_counters,
        "layout": has_layout,
        "qr_codes": has_qr_codes,
        "staff_invited": has_staff_invited,
        "step_1_business": has_profile,
        "step_2_branch": has_first_branch,
        "step_3_service": has_venue_profile,
        "step_4_layout": has_layout,
        "step_5_qr": has_qr_codes,
        "step_6_staff": has_staff_invited,
        "step_7_done": bool(
            has_profile and has_first_branch and has_venue_profile and has_layout and has_qr_codes
        ),
    }

    # Determine next_step along primary progression
    if not has_profile:
        next_step = "business_profile"
    elif not has_first_branch:
        next_step = "first_branch"
    elif not has_venue_profile:
        next_step = "venue_profile_chosen"
    elif not has_service_areas:
        next_step = "service_areas"
    elif not has_tables_or_counters:
        next_step = "tables_or_counters"
    elif not has_qr_codes:
        next_step = "qr_codes"
    elif not has_staff_invited:
        next_step = "staff_invited"
    else:
        next_step = None

    is_complete = bool(
        has_profile
        and has_first_branch
        and has_venue_profile
        and has_layout
        and has_qr_codes
        and has_staff_invited
    )
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


def upload_business_logo(
    tenant: Tenant,
    file_obj: Any,
    actor: Any | None = None,
    request: Any | None = None,
) -> dict[str, str]:
    """Uploads and validates a business logo image with security hardening.

    Invariants:
    - PNG, JPEG, WebP only; SVG is strictly forbidden.
    - Max size 2 MB; Max dimensions 4000x4000.
    - Pillow verification + safe MAX_IMAGE_PIXELS against decompression bombs.
    - Strips EXIF and metadata via re-encoding.
    - Produces 512px and 128px versions saved under random per-tenant paths.
    - Audited.
    """
    if not file_obj:
        raise BusinessRuleError("NO_FILE_PROVIDED", "No logo file was provided.", status_code=400)

    # 1. Check file size (max 2 MB)
    max_size = 2 * 1024 * 1024
    size = getattr(file_obj, "size", None)
    if size is None:
        file_obj.seek(0, 2)
        size = file_obj.tell()
        file_obj.seek(0)

    if size > max_size:
        raise BusinessRuleError(
            "IMAGE_TOO_LARGE",
            "Logo image exceeds the maximum permitted size of 2 MB.",
            status_code=400,
            details={"size_bytes": size, "max_bytes": max_size},
        )

    # 2. Reject SVG by extension or header inspection
    filename = getattr(file_obj, "name", "") or ""
    if filename.lower().endswith(".svg"):
        raise BusinessRuleError(
            "INVALID_IMAGE_FORMAT",
            "SVG files are strictly disallowed for logo uploads. Use PNG, JPEG, or WebP.",
            status_code=400,
        )

    header = file_obj.read(512)
    file_obj.seek(0)
    if b"<svg" in header.lower() or b"<?xml" in header.lower():
        raise BusinessRuleError(
            "INVALID_IMAGE_FORMAT",
            "SVG content detected. SVG files are strictly disallowed. Use PNG, JPEG, or WebP.",
            status_code=400,
        )

    # 3. Safe MAX_IMAGE_PIXELS and Pillow verification
    Image.MAX_IMAGE_PIXELS = 16_000_000

    try:
        raw_img = Image.open(file_obj)
        raw_img.verify()
    except Image.DecompressionBombError:
        raise BusinessRuleError(
            "DECOMPRESSION_BOMB",
            "Image exceeds maximum safe pixel dimensions (decompression bomb protection).",
            status_code=400,
        ) from None
    except Exception:
        raise BusinessRuleError(
            "INVALID_IMAGE",
            "Uploaded file is corrupted or not a valid image.",
            status_code=400,
        ) from None

    # Re-open after verify
    file_obj.seek(0)
    try:
        img = Image.open(file_obj)
    except Image.DecompressionBombError:
        raise BusinessRuleError(
            "DECOMPRESSION_BOMB",
            "Image exceeds maximum safe pixel dimensions (decompression bomb protection).",
            status_code=400,
        ) from None
    except Exception:
        raise BusinessRuleError(
            "INVALID_IMAGE",
            "Uploaded file could not be decoded.",
            status_code=400,
        ) from None

    img_format = (img.format or "").upper()
    if img_format not in ("PNG", "JPEG", "JPG", "WEBP"):
        raise BusinessRuleError(
            "INVALID_IMAGE_FORMAT",
            f"Unsupported format '{img_format}'. Only PNG, JPEG, and WebP are allowed.",
            status_code=400,
        )

    width, height = img.size
    if width > 4000 or height > 4000:
        raise BusinessRuleError(
            "IMAGE_DIMENSIONS_TOO_LARGE",
            f"Image dimensions ({width}x{height}) exceed maximum allowed (4000x4000).",
            status_code=400,
            details={"width": width, "height": height, "max": 4000},
        )

    # 4. Clean convert mode to RGB or RGBA (strip EXIF/metadata)
    target_mode = "RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB"
    converted_img = img.convert(target_mode)

    # 5. Generate 512px and 128px versions
    img_512 = converted_img.copy()
    img_512.thumbnail((512, 512), Image.Resampling.LANCZOS)
    buf_512 = io.BytesIO()
    img_512.save(buf_512, format="PNG", optimize=True)
    buf_512.seek(0)

    img_128 = converted_img.copy()
    img_128.thumbnail((128, 128), Image.Resampling.LANCZOS)
    buf_128 = io.BytesIO()
    img_128.save(buf_128, format="PNG", optimize=True)
    buf_128.seek(0)

    # 6. Save under random per-tenant path
    token_id = uuid.uuid4().hex
    path_512 = f"logos/{tenant.id}/{token_id}_512.png"
    path_128 = f"logos/{tenant.id}/{token_id}_128.png"

    default_storage.save(path_512, ContentFile(buf_512.getvalue()))
    default_storage.save(path_128, ContentFile(buf_128.getvalue()))

    url_512 = default_storage.url(path_512)
    url_128 = default_storage.url(path_128)

    settings, _ = BusinessSettings.unscoped.get_or_create(tenant=tenant)
    before_state = {
        "logo_url": settings.logo_url,
        "logo_128_url": settings.logo_128_url,
    }
    settings.logo_url = url_512
    settings.logo_128_url = url_128
    settings.save()
    after_state = {
        "logo_url": url_512,
        "logo_128_url": url_128,
    }

    log_audit_event(
        action="business.logo_upload",
        entity_type="BusinessSettings",
        entity_id=str(settings.id),
        tenant=tenant,
        actor=actor,
        request=request,
        before_state=before_state,
        after_state=after_state,
    )

    return {"logo_url": url_512, "logo_128_url": url_128}


def delete_business_logo(
    tenant: Tenant,
    actor: Any | None = None,
    request: Any | None = None,
) -> None:
    """Removes the business logo for a tenant with audit logging."""
    settings, _ = BusinessSettings.unscoped.get_or_create(tenant=tenant)
    before_state = {
        "logo_url": settings.logo_url,
        "logo_128_url": settings.logo_128_url,
    }

    # Delete storage files if present
    if settings.logo_url:
        try:
            rel_path = settings.logo_url.replace(default_storage.url(""), "")
            if default_storage.exists(rel_path):
                default_storage.delete(rel_path)
        except Exception:
            pass

    if settings.logo_128_url:
        try:
            rel_path = settings.logo_128_url.replace(default_storage.url(""), "")
            if default_storage.exists(rel_path):
                default_storage.delete(rel_path)
        except Exception:
            pass

    settings.logo_url = ""
    settings.logo_128_url = ""
    settings.save()
    after_state = {
        "logo_url": "",
        "logo_128_url": "",
    }

    log_audit_event(
        action="business.logo_delete",
        entity_type="BusinessSettings",
        entity_id=str(settings.id),
        tenant=tenant,
        actor=actor,
        request=request,
        before_state=before_state,
        after_state=after_state,
    )
