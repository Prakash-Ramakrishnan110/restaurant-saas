from __future__ import annotations

import secrets
import zoneinfo
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.subscriptions.services import enforce_limit
from apps.tenants.models import Branch
from apps.venues.constants import (
    ALLOWED_TABLE_STATUS_TRANSITIONS,
    OpenedVia,
    OrderWorkflow,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
    QRTargetType,
    SessionStatus,
    TableShape,
    TableStatus,
    TableType,
)
from apps.venues.models import (
    BranchCapabilities,
    DiningTable,
    QRCode,
    Section,
    ServiceArea,
    StaffSectionAssignment,
    TableGroup,
    TableSession,
    TokenCounter,
)
from apps.venues.presets import get_preset_capabilities


def validate_capabilities(data: dict[str, Any]) -> None:
    """Validate 7 invariant capability rules across branch operations.

    R1 order_workflow COUNTER_TOKEN requires uses_token_numbers = true
    R2 order_workflow TABLE_SERVICE requires uses_tables = true
    R3 order_workflow ROOM_SERVICE requires allows_room_service = true
    R4 supports_courses requires uses_tables = true
    R5 has_sections and has_seat_ordering each require uses_tables = true
    R6 allows_room_charge requires payment_timing != PAY_FIRST
    R7 qr_ordering_mode ORDER_WITH_APPROVAL or ORDER_DIRECT requires allows_qr_ordering = true
    """
    order_workflow = data.get("order_workflow")
    uses_token_numbers = data.get("uses_token_numbers")
    uses_tables = data.get("uses_tables")
    allows_room_service = data.get("allows_room_service")
    supports_courses = data.get("supports_courses")
    has_sections = data.get("has_sections")
    has_seat_ordering = data.get("has_seat_ordering")
    allows_room_charge = data.get("allows_room_charge")
    payment_timing = data.get("payment_timing")
    qr_ordering_mode = data.get("qr_ordering_mode")
    allows_qr_ordering = data.get("allows_qr_ordering")

    errors: dict[str, str] = {}

    if order_workflow == OrderWorkflow.COUNTER_TOKEN and not uses_token_numbers:
        errors["order_workflow"] = "COUNTER_TOKEN workflow requires uses_token_numbers = true."
        errors["uses_token_numbers"] = "Required when order_workflow is COUNTER_TOKEN."

    if order_workflow == OrderWorkflow.TABLE_SERVICE and not uses_tables:
        errors["order_workflow"] = "TABLE_SERVICE workflow requires uses_tables = true."
        errors["uses_tables"] = "Required when order_workflow is TABLE_SERVICE."

    if order_workflow == OrderWorkflow.ROOM_SERVICE and not allows_room_service:
        errors["order_workflow"] = "ROOM_SERVICE workflow requires allows_room_service = true."
        errors["allows_room_service"] = "Required when order_workflow is ROOM_SERVICE."

    if supports_courses and not uses_tables:
        errors["supports_courses"] = "supports_courses requires uses_tables = true."
        errors.setdefault("uses_tables", "Required when supports_courses is true.")

    if has_sections and not uses_tables:
        errors["has_sections"] = "has_sections requires uses_tables = true."
        errors.setdefault("uses_tables", "Required when has_sections is true.")

    if has_seat_ordering and not uses_tables:
        errors["has_seat_ordering"] = "has_seat_ordering requires uses_tables = true."
        errors.setdefault("uses_tables", "Required when has_seat_ordering is true.")

    if allows_room_charge and payment_timing == PaymentTiming.PAY_FIRST:
        errors["allows_room_charge"] = "allows_room_charge requires payment_timing != PAY_FIRST."
        errors["payment_timing"] = (
            "payment_timing cannot be PAY_FIRST when allows_room_charge is true."
        )

    if (
        qr_ordering_mode in (QROrderingMode.ORDER_WITH_APPROVAL, QROrderingMode.ORDER_DIRECT)
        and not allows_qr_ordering
    ):
        errors["qr_ordering_mode"] = f"{qr_ordering_mode} requires allows_qr_ordering = true."
        errors["allows_qr_ordering"] = f"Required when qr_ordering_mode is {qr_ordering_mode}."

    if errors:
        raise ValidationError(errors, code="INVALID_CAPABILITY_COMBINATION")


@transaction.atomic
def apply_preset(
    branch: Branch,
    profile: str | None = None,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> BranchCapabilities:
    """Applies the default capabilities preset matching the venue profile to the branch."""
    if get_current_tenant() is None:
        set_current_tenant(branch.tenant)

    venue_profile = profile or branch.venue_profile
    preset_data = get_preset_capabilities(venue_profile)

    capabilities, created = BranchCapabilities.objects.get_or_create(
        branch=branch,
        tenant=branch.tenant,
        defaults=preset_data,
    )

    if not created:
        before_state = {
            "payment_timing": capabilities.payment_timing,
            "qr_ordering_mode": capabilities.qr_ordering_mode,
            "qr_session_policy": capabilities.qr_session_policy,
            "order_workflow": capabilities.order_workflow,
            "uses_tables": capabilities.uses_tables,
            "uses_token_numbers": capabilities.uses_token_numbers,
            "uses_kds": capabilities.uses_kds,
            "supports_courses": capabilities.supports_courses,
        }
        for key, val in preset_data.items():
            setattr(capabilities, key, val)
        capabilities.save()

        log_audit_event(
            action="branch.capabilities.apply_preset",
            entity_type="BranchCapabilities",
            entity_id=str(capabilities.id),
            actor=actor,
            tenant=branch.tenant,
            before_state=before_state,
            after_state=preset_data,
            request=request,
        )
    else:
        log_audit_event(
            action="branch.capabilities.create_preset",
            entity_type="BranchCapabilities",
            entity_id=str(capabilities.id),
            actor=actor,
            tenant=branch.tenant,
            after_state=preset_data,
            request=request,
        )

    return capabilities


@transaction.atomic
def update_capabilities(
    branch: Branch,
    capabilities_data: dict[str, Any],
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> BranchCapabilities:
    """Updates capability flags with entitlement enforcement and audit trail."""
    if get_current_tenant() is None:
        set_current_tenant(branch.tenant)

    capabilities, _ = BranchCapabilities.objects.get_or_create(
        branch=branch,
        tenant=branch.tenant,
        defaults=get_preset_capabilities(branch.venue_profile),
    )

    # Entitlement check: verify whether feature flags (e.g. courses) are allowed by tenant's plan
    if capabilities_data.get("supports_courses") is True:
        enforce_limit(branch.tenant, "courses")

    # Validate merged capability invariant rules
    merged = {
        "payment_timing": capabilities.payment_timing,
        "qr_ordering_mode": capabilities.qr_ordering_mode,
        "qr_session_policy": capabilities.qr_session_policy,
        "order_workflow": capabilities.order_workflow,
        "uses_tables": capabilities.uses_tables,
        "uses_token_numbers": capabilities.uses_token_numbers,
        "uses_kds": capabilities.uses_kds,
        "supports_courses": capabilities.supports_courses,
        "allows_takeaway": capabilities.allows_takeaway,
        "allows_room_service": capabilities.allows_room_service,
        "allows_room_charge": capabilities.allows_room_charge,
        "has_sections": capabilities.has_sections,
        "has_seat_ordering": capabilities.has_seat_ordering,
        "allows_table_transfer": capabilities.allows_table_transfer,
        "allows_qr_ordering": capabilities.allows_qr_ordering,
    }
    merged.update(capabilities_data)
    validate_capabilities(merged)

    before_state = {
        "payment_timing": capabilities.payment_timing,
        "qr_ordering_mode": capabilities.qr_ordering_mode,
        "qr_session_policy": capabilities.qr_session_policy,
        "order_workflow": capabilities.order_workflow,
        "uses_tables": capabilities.uses_tables,
        "uses_token_numbers": capabilities.uses_token_numbers,
        "uses_kds": capabilities.uses_kds,
        "supports_courses": capabilities.supports_courses,
        "allows_takeaway": capabilities.allows_takeaway,
        "allows_room_service": capabilities.allows_room_service,
        "allows_room_charge": capabilities.allows_room_charge,
        "has_sections": capabilities.has_sections,
        "has_seat_ordering": capabilities.has_seat_ordering,
        "allows_table_transfer": capabilities.allows_table_transfer,
        "allows_qr_ordering": capabilities.allows_qr_ordering,
    }

    for key, val in capabilities_data.items():
        if hasattr(capabilities, key):
            setattr(capabilities, key, val)
    capabilities.save()

    after_state = {k: getattr(capabilities, k) for k in before_state}

    log_audit_event(
        action="branch.capabilities.update",
        entity_type="BranchCapabilities",
        entity_id=str(capabilities.id),
        actor=actor,
        tenant=branch.tenant,
        before_state=before_state,
        after_state=after_state,
        request=request,
    )

    return capabilities


@transaction.atomic
def transition_table_status(
    table: DiningTable,
    target_status: str | None = None,
    new_status: str | None = None,
    reason: str = "",
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> DiningTable:
    """Enforces allowed state machine transitions for DiningTable.status."""
    if get_current_tenant() is None:
        set_current_tenant(table.tenant)

    target = target_status or new_status
    if not target:
        raise ValidationError("Target status is required.")

    current_status = table.status

    if current_status == target:
        return table

    allowed_targets = ALLOWED_TABLE_STATUS_TRANSITIONS.get(current_status, set())
    if target not in allowed_targets:
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Cannot change table status from '{current_status}' to '{target}'.",
            status_code=400,
            details={"from": current_status, "to": target, "allowed": sorted(allowed_targets)},
        )

    table.status = target
    table.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="table.status_transition",
        entity_type="DiningTable",
        entity_id=str(table.id),
        actor=actor,
        tenant=table.tenant,
        before_state={"status": current_status},
        after_state={"status": target, "reason": reason},
        request=request,
    )

    return table


@transaction.atomic
def join_tables(
    branch: Branch,
    table_ids: list[str],
    label: str = "",
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> TableGroup:
    """Merges multiple combinable tables into a temporary TableGroup."""
    if get_current_tenant() is None:
        set_current_tenant(branch.tenant)

    enforce_limit(branch.tenant, "table_merge")

    tables = list(DiningTable.objects.filter(branch=branch, id__in=table_ids))
    if len(tables) != len(table_ids):
        raise ValidationError("One or more table IDs are invalid or belong to another branch.")

    if len(tables) < 2:
        raise BusinessRuleError(
            "TABLES_NOT_COMBINABLE", "At least two tables are required to form a table group."
        )

    for t in tables:
        if not t.is_combinable:
            raise BusinessRuleError(
                "TABLES_NOT_COMBINABLE",
                f"Table '{t.label}' is marked as non-combinable.",
                details={"table": t.label},
            )
        if t.status not in (TableStatus.AVAILABLE, TableStatus.OCCUPIED):
            raise BusinessRuleError(
                "TABLES_NOT_COMBINABLE",
                f"Table '{t.label}' cannot be joined while in status '{t.status}'.",
                details={"table": t.label, "status": t.status},
            )

    group_label = label or " + ".join(sorted([t.label for t in tables]))
    group = TableGroup.objects.create(
        tenant=branch.tenant,
        branch=branch,
        label=group_label,
        is_active=True,
    )

    for t in tables:
        t.group = group
        t.save(update_fields=["group", "updated_at"])

    log_audit_event(
        action="table.join",
        entity_type="TableGroup",
        entity_id=str(group.id),
        actor=actor,
        tenant=branch.tenant,
        after_state={"label": group_label, "table_ids": [str(t.id) for t in tables]},
        request=request,
    )

    return group


@transaction.atomic
def split_tables(
    group: TableGroup,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> None:
    """Disbands an active table group and unassigns joined tables."""
    if get_current_tenant() is None:
        set_current_tenant(group.tenant)

    tables = list(group.tables.all())
    table_ids = [str(t.id) for t in tables]

    for t in tables:
        t.group = None
        t.save(update_fields=["group", "updated_at"])

    group.is_active = False
    group.save(update_fields=["is_active", "updated_at"])

    log_audit_event(
        action="table.split",
        entity_type="TableGroup",
        entity_id=str(group.id),
        actor=actor,
        tenant=group.tenant,
        before_state={"table_ids": table_ids, "is_active": True},
        after_state={"is_active": False},
        request=request,
    )


@transaction.atomic
def assign_waiter_to_section(
    membership: Any,
    section: Section,
    valid_from: Any | None = None,
    valid_to: Any | None = None,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> StaffSectionAssignment:
    """Assigns a waiter staff member to a section within their assigned branch."""
    # Ensure waiter's membership is within the branch scope if branch restrictions exist
    if membership.branches.exists():
        if section.branch not in membership.branches.all():
            raise ValidationError("Staff member is not assigned to this branch.")

    assignment = StaffSectionAssignment.objects.create(
        tenant=section.tenant,
        branch=section.branch,
        membership=membership,
        section=section,
        valid_from=valid_from or timezone.now(),
        valid_to=valid_to,
    )

    log_audit_event(
        action="staff.assign_section",
        entity_type="StaffSectionAssignment",
        entity_id=str(assignment.id),
        actor=actor,
        tenant=section.tenant,
        after_state={
            "membership_id": str(membership.id),
            "section_id": str(section.id),
            "branch_id": str(section.branch.id),
        },
        request=request,
    )

    return assignment


@transaction.atomic
def open_session(
    branch: Branch | None = None,
    table: DiningTable | None = None,
    table_group: TableGroup | None = None,
    group: TableGroup | None = None,
    opened_via: str = OpenedVia.STAFF,
    opened_by: Any | None = None,
    guest_count: int = 1,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> TableSession:
    """Opens a new dining session on a table or table group."""
    grp = table_group or group
    if not table and not grp:
        raise ValidationError("A table or table group is required to open a session.")

    br = branch or (table.branch if table else grp.branch)  # type: ignore[union-attr]
    if get_current_tenant() is None:
        set_current_tenant(br.tenant)

    # Verify QR session policy
    if opened_via in (OpenedVia.QR, OpenedVia.QR_CUSTOMER):
        capabilities = getattr(br, "capabilities", None)
        if capabilities and capabilities.qr_session_policy == QRSessionPolicy.STAFF_ONLY:
            raise PermissionDenied(
                "This venue requires restaurant staff to open the table session."
            )

    if table and table.status in (TableStatus.BLOCKED, TableStatus.CLEANING):
        raise BusinessRuleError(
            "TABLE_NOT_AVAILABLE",
            f"Table '{table.label}' is {table.status.lower()} and cannot be seated right now.",
            status_code=409,
            details={"table": table.label, "status": table.status},
        )

    # Check for existing open session on table or table_group
    if table:
        existing = TableSession.objects.filter(table=table, status=SessionStatus.OPEN).first()
        if existing:
            if opened_via in (OpenedVia.QR, OpenedVia.QR_CUSTOMER):
                return existing
            raise BusinessRuleError(
                "SESSION_ALREADY_OPEN",
                "An active session is already open on this table.",
                status_code=409,
                details={"session_code": existing.session_code},
            )
    if grp:
        existing_grp = TableSession.objects.filter(
            table_group=grp, status=SessionStatus.OPEN
        ).first()
        if existing_grp:
            if opened_via in (OpenedVia.QR, OpenedVia.QR_CUSTOMER):
                return existing_grp
            raise BusinessRuleError(
                "SESSION_ALREADY_OPEN",
                "An active session is already open on this table group.",
                status_code=409,
                details={"session_code": existing_grp.session_code},
            )

    session_code = secrets.token_hex(3).upper()

    session = TableSession.objects.create(
        tenant=br.tenant,
        branch=br,
        table=table,
        table_group=grp,
        status=SessionStatus.OPEN,
        opened_via=opened_via,
        opened_by=opened_by,
        guest_count=guest_count,
        session_code=session_code,
        opened_at=timezone.now(),
        last_activity_at=timezone.now(),
        expires_at=timezone.now() + timedelta(hours=3),
    )

    if table and table.status != TableStatus.OCCUPIED:
        table.status = TableStatus.OCCUPIED
        table.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="table_session.open",
        entity_type="TableSession",
        entity_id=str(session.id),
        actor=actor,
        tenant=br.tenant,
        after_state={
            "session_code": session_code,
            "table_id": str(table.id) if table else None,
            "group_id": str(grp.id) if grp else None,
            "opened_via": opened_via,
            "guest_count": guest_count,
        },
        request=request,
    )

    return session


@transaction.atomic
def close_session(
    session: TableSession,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> TableSession:
    """Closes an active dining session and transitions table to CLEANING."""
    if get_current_tenant() is None:
        set_current_tenant(session.tenant)

    if session.status == SessionStatus.CLOSED:
        return session

    session.status = SessionStatus.CLOSED
    session.closed_at = timezone.now()
    session.save(update_fields=["status", "closed_at", "updated_at"])

    if session.table:
        session.table.status = TableStatus.CLEANING
        session.table.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="table_session.close",
        entity_type="TableSession",
        entity_id=str(session.id),
        actor=actor,
        tenant=session.tenant,
        after_state={"session_code": session.session_code, "status": SessionStatus.CLOSED},
        request=request,
    )

    return session


def touch_session(session: TableSession) -> None:
    """Updates last_activity_at timestamp to prevent idle timeout."""
    if get_current_tenant() is None:
        set_current_tenant(session.tenant)

    session.last_activity_at = timezone.now()
    session.save(update_fields=["last_activity_at"])


def expire_idle_sessions(timeout_minutes: int = 180) -> int:
    """Celery scheduled task to close abandoned table sessions exceeding idle threshold."""
    cutoff = timezone.now() - timedelta(minutes=timeout_minutes)
    from apps.tenants.services import get_idle_sessions

    idle_sessions = get_idle_sessions(cutoff)
    closed_count = 0
    for s in idle_sessions:
        close_session(s)
        closed_count += 1

    return closed_count


@transaction.atomic
def generate_qr_code(
    branch: Branch,
    target_type: str = QRTargetType.TABLE,
    table: DiningTable | None = None,
    service_area: ServiceArea | None = None,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> QRCode:
    """Generates a non-guessable, rotating 24-byte cryptographic QR token."""
    if get_current_tenant() is None:
        set_current_tenant(branch.tenant)

    public_token = secrets.token_urlsafe(24)

    qr = QRCode.objects.create(
        tenant=branch.tenant,
        branch=branch,
        target_type=target_type,
        table=table,
        service_area=service_area,
        public_token=public_token,
        is_active=True,
        version=1,
        rotated_at=timezone.now(),
    )

    log_audit_event(
        action="qr.create",
        entity_type="QRCode",
        entity_id=str(qr.id),
        actor=actor,
        tenant=branch.tenant,
        after_state={
            "target_type": target_type,
            "table_id": str(table.id) if table else None,
            "service_area_id": str(service_area.id) if service_area else None,
            "version": 1,
        },
        request=request,
    )

    return qr


@transaction.atomic
def rotate_qr_code(
    qr_code: QRCode,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> QRCode:
    """Rotates token immediately, invalidating the previous token."""
    if get_current_tenant() is None:
        set_current_tenant(qr_code.tenant)

    old_token = qr_code.public_token
    new_token = secrets.token_urlsafe(24)

    qr_code.public_token = new_token
    qr_code.version += 1
    qr_code.rotated_at = timezone.now()
    qr_code.save(update_fields=["public_token", "version", "rotated_at", "updated_at"])

    log_audit_event(
        action="qr.rotate",
        entity_type="QRCode",
        entity_id=str(qr_code.id),
        actor=actor,
        tenant=qr_code.tenant,
        before_state={"version": qr_code.version - 1, "token_prefix": old_token[:8]},
        after_state={"version": qr_code.version, "token_prefix": new_token[:8]},
        request=request,
    )

    return qr_code


@transaction.atomic
def deactivate_qr_code(
    qr_code: QRCode,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> None:
    """Deactivates a QR code."""
    if get_current_tenant() is None:
        set_current_tenant(qr_code.tenant)

    qr_code.is_active = False
    qr_code.save(update_fields=["is_active", "updated_at"])

    log_audit_event(
        action="qr.deactivate",
        entity_type="QRCode",
        entity_id=str(qr_code.id),
        actor=actor,
        tenant=qr_code.tenant,
        after_state={"is_active": False},
        request=request,
    )


@transaction.atomic
def next_token(
    branch: Branch,
    service_area: ServiceArea | None = None,
) -> int:
    """Atomically increments and returns the next daily sequential token number.

    Resets daily at midnight in the tenant's configured timezone.
    """
    prev_tenant = get_current_tenant()
    token = set_current_tenant(branch.tenant) if prev_tenant != branch.tenant else None
    try:
        # Lock branch row to serialize concurrent cold-start creations
        Branch.objects.select_for_update().only("id").get(pk=branch.pk)

        tz_name = branch.tenant.timezone or "Asia/Kolkata"
        tz = zoneinfo.ZoneInfo(tz_name)
        local_date = timezone.now().astimezone(tz).date()

        counter, created = TokenCounter.objects.select_for_update().get_or_create(
            branch=branch,
            service_date=local_date,
            service_area=service_area,
            defaults={
                "tenant": branch.tenant,
                "last_number": 1,
            },
        )

        if not created:
            counter.last_number += 1
            counter.save(update_fields=["last_number", "updated_at"])

        return counter.last_number
    finally:
        if token is not None:
            reset_current_tenant(token)


def assert_table_label_free(branch: Branch, label: str, exclude_id: Any | None = None) -> None:
    """Raise DUPLICATE_LABEL (409) when an active table in the branch already uses the label."""
    qs = DiningTable.objects.filter(branch=branch, label=label, is_active=True)
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        raise BusinessRuleError(
            "DUPLICATE_LABEL",
            f"A table labelled '{label}' already exists in this branch.",
            status_code=409,
            details={"label": label},
        )


@transaction.atomic
def bulk_create_tables(
    section: Section,
    prefix: str = "T",
    start: int = 1,
    count: int = 10,
    table_type: str = TableType.TABLE,
    min_capacity: int = 1,
    capacity: int = 4,
    is_combinable: bool = True,
    shape: str = TableShape.SQUARE,
    actor: Any | None = None,
    request: HttpRequest | None = None,
) -> list[DiningTable]:
    """Bulk provisions tables within a section, respecting plan entitlements."""
    if get_current_tenant() is None:
        set_current_tenant(section.tenant)

    current_tables = DiningTable.objects.filter(tenant=section.tenant, is_active=True).count()
    enforce_limit(section.tenant, "max_tables", current_tables + count - 1)

    for i in range(count):
        assert_table_label_free(section.branch, f"{prefix}{start + i}")

    created_tables: list[DiningTable] = []

    # Calculate layout grid positions
    cols = 5
    spacing_x = 120.0
    spacing_y = 120.0

    for i in range(count):
        idx = start + i
        label = f"{prefix}{idx}"
        col = i % cols
        row = i // cols

        table = DiningTable.objects.create(
            tenant=section.tenant,
            branch=section.branch,
            section=section,
            label=label,
            table_type=table_type,
            min_capacity=min_capacity,
            capacity=capacity,
            is_combinable=is_combinable,
            is_active=True,
            status=TableStatus.AVAILABLE,
            x=50.0 + col * spacing_x,
            y=50.0 + row * spacing_y,
            width=80.0,
            height=80.0,
            shape=shape,
        )
        created_tables.append(table)

    log_audit_event(
        action="table.bulk_create",
        entity_type="Section",
        entity_id=str(section.id),
        actor=actor,
        tenant=section.tenant,
        after_state={"labels": [t.label for t in created_tables], "count": count},
        request=request,
    )

    return created_tables


def render_qr_image(qr_code: QRCode, image_format: str = "png") -> tuple[bytes, str]:
    """Renders a QR code image encoding the public token URL.

    Results are cached in Redis for 1 hour keyed by qr_code id and version.
    """
    import io

    import segno
    from django.conf import settings
    from django.core.cache import cache

    fmt = image_format.lower()
    if fmt not in ("png", "svg"):
        fmt = "png"

    content_type = "image/png" if fmt == "png" else "image/svg+xml"
    cache_key = f"qr_image:{qr_code.id}:{qr_code.version}:{fmt}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return cached_data, content_type

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
    target_url = f"{frontend_url}/qr/{qr_code.public_token}"

    qr = segno.make(target_url, error="m")
    out = io.BytesIO()
    qr.save(out, kind=fmt, scale=5)
    image_bytes = out.getvalue()

    cache.set(cache_key, image_bytes, timeout=3600)
    return image_bytes, content_type
