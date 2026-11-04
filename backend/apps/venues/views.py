from __future__ import annotations

from typing import Any

from django.core.signing import TimestampSigner
from django.http import Http404, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant, set_current_tenant
from apps.rbac.constants import Permission
from apps.rbac.permissions import HasTenantPermission, verify_tenant_and_branch_access
from apps.subscriptions.services import enforce_limit, is_tenant_allowed
from apps.tenants.models import Branch
from apps.tenants.services import get_public_qr_code
from apps.venues.constants import (
    OpenedVia,
    QROrderingMode,
    QRSessionPolicy,
    SessionStatus,
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
)
from apps.venues.presets import VENUE_CAPABILITY_PRESETS
from apps.venues.serializers import (
    BranchCapabilitiesSerializer,
    BulkTableCreateSerializer,
    DiningTableSerializer,
    GenerateQRCodeSerializer,
    OpenSessionSerializer,
    PublicQRDetailSerializer,
    PublicQROpenSessionResponseSerializer,
    PublicQROpenSessionSerializer,
    QRCodeSerializer,
    SectionSerializer,
    ServiceAreaSerializer,
    StaffSectionAssignmentSerializer,
    TableGroupSerializer,
    TableJoinSerializer,
    TableLayoutUpdateSerializer,
    TableSessionSerializer,
    TableSplitSerializer,
    TableStatusTransitionSerializer,
)
from apps.venues.services import (
    bulk_create_tables,
    close_session,
    deactivate_qr_code,
    generate_qr_code,
    join_tables,
    open_session,
    render_qr_image,
    rotate_qr_code,
    split_tables,
    transition_table_status,
    update_capabilities,
)


class VenuePresetsView(APIView):
    """List standard venue capability presets."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.BRANCH_VIEW)]

    def get(self, request: Request) -> Response:
        return Response(VENUE_CAPABILITY_PRESETS)


class BranchCapabilitiesView(APIView):
    """Retrieve or update capabilities configuration for a branch."""

    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.request.method == "PATCH":
            return [IsAuthenticated(), HasTenantPermission(Permission.BRANCH_MANAGE)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.BRANCH_VIEW)()]

    def get_branch(self, branch_id: str) -> Branch:
        try:
            branch = Branch.objects.get(id=branch_id)
        except (Branch.DoesNotExist, ValueError):
            raise Http404("Branch not found.") from None
        verify_tenant_and_branch_access(self.request.user, branch)
        return branch

    def get(self, request: Request, branch_id: str) -> Response:
        branch = self.get_branch(branch_id)
        capabilities, _ = BranchCapabilities.objects.get_or_create(
            branch=branch,
            defaults={"tenant": branch.tenant},
        )
        serializer = BranchCapabilitiesSerializer(capabilities)
        return Response(serializer.data)

    def patch(self, request: Request, branch_id: str) -> Response:
        branch = self.get_branch(branch_id)
        capabilities, _ = BranchCapabilities.objects.get_or_create(
            branch=branch,
            defaults={"tenant": branch.tenant},
        )
        serializer = BranchCapabilitiesSerializer(capabilities, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        capabilities = update_capabilities(
            branch=branch,
            capabilities_data=serializer.validated_data,
            actor=request.user,
            request=request,
        )
        return Response(BranchCapabilitiesSerializer(capabilities).data)


class ServiceAreaViewSet(viewsets.ModelViewSet):
    """CRUD for branch service areas."""

    serializer_class = ServiceAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.AREA_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.AREA_MANAGE)()]

    def get_queryset(self) -> Any:
        qs = ServiceArea.objects.all().select_related("branch")
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None)
        branch = serializer.validated_data.get("branch")
        verify_tenant_and_branch_access(self.request.user, branch)

        # Enforce plan limits
        current_count = ServiceArea.objects.filter(branch=branch).count()
        enforce_limit(tenant, "max_service_areas", current_count)

        instance = serializer.save(tenant=tenant)
        log_audit_event(
            action="service_area.create",
            entity_type="ServiceArea",
            entity_id=str(instance.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": instance.name, "area_type": instance.area_type},
            request=self.request,
        )


class SectionViewSet(viewsets.ModelViewSet):
    """CRUD for floor/area sections."""

    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.AREA_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.FLOOR_MANAGE)()]

    def get_queryset(self) -> Any:
        qs = Section.objects.all().select_related("service_area", "branch")
        service_area_id = self.request.query_params.get("service_area_id")
        branch_id = self.request.query_params.get("branch_id")
        if service_area_id:
            qs = qs.filter(service_area_id=service_area_id)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None)
        branch = serializer.validated_data.get("branch")
        service_area = serializer.validated_data.get("service_area")
        verify_tenant_and_branch_access(self.request.user, branch)
        verify_tenant_and_branch_access(self.request.user, service_area)

        instance = serializer.save(tenant=tenant)
        log_audit_event(
            action="section.create",
            entity_type="Section",
            entity_id=str(instance.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": instance.name, "color": instance.color},
            request=self.request,
        )


class DiningTableViewSet(viewsets.ModelViewSet):
    """CRUD and lifecycle operations for dining tables."""

    serializer_class = DiningTableSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_VIEW)()]
        if self.action == "status_transition":
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_STATUS_UPDATE)()]
        if self.action in ("join", "split"):
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_MERGE)()]
        if self.action == "layout":
            return [IsAuthenticated(), HasTenantPermission(Permission.FLOOR_MANAGE)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_MANAGE)()]

    def get_queryset(self) -> Any:
        qs = DiningTable.objects.all().select_related("section", "branch", "group")
        section_id = self.request.query_params.get("section_id")
        branch_id = self.request.query_params.get("branch_id")
        status_filter = self.request.query_params.get("status")
        if section_id:
            qs = qs.filter(section_id=section_id)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        branch = serializer.validated_data.get("branch")
        section = serializer.validated_data.get("section")
        verify_tenant_and_branch_access(self.request.user, branch)
        verify_tenant_and_branch_access(self.request.user, section)

        current_count = DiningTable.objects.filter(tenant=tenant, is_active=True).count()
        enforce_limit(tenant, "max_tables", current_count)

        instance = serializer.save(tenant=tenant)
        log_audit_event(
            action="table.create",
            entity_type="DiningTable",
            entity_id=str(instance.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"label": instance.label, "status": instance.status},
            request=self.request,
        )

    @action(detail=True, methods=["post"], url_path="status")
    def status_transition(self, request: Request, pk: str | None = None) -> Response:
        table = self.get_object()
        serializer = TableStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_status = serializer.validated_data["status"]
        reason = serializer.validated_data.get("reason", "")

        table = transition_table_status(
            table=table,
            target_status=target_status,
            actor=request.user,
            reason=reason,
            request=request,
        )
        return Response(DiningTableSerializer(table).data)

    @action(detail=False, methods=["post"], url_path="join")
    def join(self, request: Request) -> Response:
        serializer = TableJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        table_ids = serializer.validated_data["table_ids"]
        label = serializer.validated_data.get("label", "")

        first_table = None
        for tid in table_ids:
            table_obj = DiningTable.objects.filter(id=tid).first()
            if not table_obj:
                raise ValidationError(
                    {"table_ids": ["Invalid reference - object does not exist."]},
                    code="INVALID_REFERENCE",
                )
            verify_tenant_and_branch_access(request.user, table_obj)
            if first_table is None:
                first_table = table_obj
        assert first_table is not None

        group = join_tables(
            branch=first_table.branch,
            table_ids=table_ids,
            label=label,
            actor=request.user,
            request=request,
        )
        return Response(TableGroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="split")
    def split(self, request: Request) -> Response:
        serializer = TableSplitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        group_id = serializer.validated_data["group_id"]
        try:
            group = TableGroup.objects.get(id=group_id)
        except TableGroup.DoesNotExist:
            raise ValidationError(
                {"group_id": ["Invalid reference - object does not exist."]},
                code="INVALID_REFERENCE",
            ) from None
        verify_tenant_and_branch_access(request.user, group)

        split_tables(group=group, actor=request.user, request=request)
        return Response({"detail": "Tables split successfully."})

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request: Request) -> Response:
        serializer = BulkTableCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        try:
            section = Section.objects.get(id=data["section_id"])
        except (Section.DoesNotExist, ValueError):
            raise ValidationError(
                {"section_id": ["Invalid reference - object does not exist."]},
                code="INVALID_REFERENCE",
            ) from None
        verify_tenant_and_branch_access(request.user, section)

        tables = bulk_create_tables(
            section=section,
            prefix=data.get("prefix", "T"),
            start=data.get("start_number", 1),
            count=data.get("count", 10),
            table_type=data.get("table_type", "TABLE"),
            capacity=data.get("capacity", 4),
            shape=data.get("shape", "SQUARE"),
            actor=request.user,
            request=request,
        )
        return Response(
            DiningTableSerializer(tables, many=True).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post", "patch"], url_path="layout")
    def layout(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None)
        enforce_limit(tenant, "floor_editor")

        serializer = TableLayoutUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tables_data = serializer.validated_data["tables"]
        updated_count = 0

        for item in tables_data:
            table_id = item["id"]
            try:
                table = DiningTable.objects.get(id=table_id)
            except (DiningTable.DoesNotExist, ValueError):
                raise ValidationError(
                    {"tables": ["Invalid reference - object does not exist."]},
                    code="INVALID_REFERENCE",
                ) from None
            verify_tenant_and_branch_access(request.user, table)

            fields_to_update = []
            for field in ("x", "y", "width", "height", "rotation", "shape"):
                if field in item:
                    setattr(table, field, item[field])
                    fields_to_update.append(field)
            if fields_to_update:
                table.save(update_fields=fields_to_update + ["updated_at"])
                updated_count += 1

        return Response({"detail": f"Updated layout for {updated_count} tables."})


class TableGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """View active table groups."""

    serializer_class = TableGroupSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.TABLE_VIEW)]

    def get_queryset(self) -> Any:
        return TableGroup.objects.filter(is_active=True).prefetch_related("tables")


class TableSessionViewSet(viewsets.ModelViewSet):
    """Manage table dining sessions."""

    serializer_class = TableSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_VIEW)()]
        if self.action == "open":
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_SESSION_OPEN)()]
        if self.action == "close":
            return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_SESSION_CLOSE)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_VIEW)()]

    def get_queryset(self) -> Any:
        qs = TableSession.objects.all().select_related("table", "table_group", "opened_by__user")
        branch_id = self.request.query_params.get("branch_id")
        table_id = self.request.query_params.get("table_id")
        status_filter = self.request.query_params.get("status")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if table_id:
            qs = qs.filter(table_id=table_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=False, methods=["post"], url_path="open")
    def open(self, request: Request) -> Response:
        serializer = OpenSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        table = None
        group = None

        if data.get("table_id"):
            try:
                table = DiningTable.objects.get(id=data["table_id"])
            except DiningTable.DoesNotExist:
                raise ValidationError(
                    {"table_id": ["Invalid reference - object does not exist."]},
                    code="INVALID_REFERENCE",
                ) from None
            verify_tenant_and_branch_access(request.user, table)
            branch = table.branch
        elif data.get("table_group_id"):
            try:
                group = TableGroup.objects.get(id=data["table_group_id"])
            except TableGroup.DoesNotExist:
                raise ValidationError(
                    {"table_group_id": ["Invalid reference - object does not exist."]},
                    code="INVALID_REFERENCE",
                ) from None
            verify_tenant_and_branch_access(request.user, group)
            branch = group.branch
        else:
            raise ValidationError("Either table_id or table_group_id must be provided.")

        membership = getattr(request, "membership", None)
        session = open_session(
            branch=branch,
            table=table,
            table_group=group,
            opened_via=OpenedVia.STAFF,
            opened_by=membership,
            guest_count=data.get("guest_count", 1),
            actor=request.user,
            request=request,
        )
        return Response(TableSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request: Request, pk: str | None = None) -> Response:
        session = self.get_object()
        session = close_session(session=session, actor=request.user, request=request)
        return Response(TableSessionSerializer(session).data)


class StaffSectionAssignmentViewSet(viewsets.ModelViewSet):
    """Assign staff members to sections."""

    serializer_class = StaffSectionAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.STAFF_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.TABLE_ASSIGN)()]

    def get_queryset(self) -> Any:
        return StaffSectionAssignment.objects.all().select_related("membership__user", "section")

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None)
        section = serializer.validated_data.get("section")
        branch = serializer.validated_data.get("branch")
        membership = serializer.validated_data.get("membership")
        verify_tenant_and_branch_access(self.request.user, section)
        if branch:
            verify_tenant_and_branch_access(self.request.user, branch)
        if membership and tenant and membership.tenant_id != tenant.id:
            raise ValidationError(
                {"membership": ["Invalid reference - object does not exist."]},
                code="does_not_exist",
            )

        serializer.save(tenant=tenant)


class PNGRenderer(BaseRenderer):
    media_type = "image/png"
    format = "png"

    def render(
        self,
        data: Any,
        accepted_media_type: str | None = None,
        renderer_context: Any = None,
    ) -> Any:
        return data


class SVGRenderer(BaseRenderer):
    media_type = "image/svg+xml"
    format = "svg"

    def render(
        self,
        data: Any,
        accepted_media_type: str | None = None,
        renderer_context: Any = None,
    ) -> Any:
        return data


class QRCodeViewSet(viewsets.ModelViewSet):
    """Staff management of cryptographic QR tokens."""

    serializer_class = QRCodeSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve", "image"):
            return [IsAuthenticated(), HasTenantPermission(Permission.QR_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.QR_MANAGE)()]

    def get_queryset(self) -> Any:
        qs = QRCode.objects.all().select_related("branch", "table")
        branch_id = self.request.query_params.get("branch_id")
        table_id = self.request.query_params.get("table_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if table_id:
            qs = qs.filter(table_id=table_id)
        return qs

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        qr = self.get_object()
        deactivate_qr_code(qr_code=qr, actor=request.user, request=request)
        return Response({"detail": "QR code deactivated successfully."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request: Request) -> Response:
        serializer = GenerateQRCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        try:
            branch = Branch.objects.get(id=data["branch_id"])
        except (Branch.DoesNotExist, ValueError):
            raise ValidationError(
                {"branch_id": ["Invalid reference - object does not exist."]},
                code="INVALID_REFERENCE",
            ) from None
        verify_tenant_and_branch_access(request.user, branch)

        table = None
        if data.get("table_id"):
            try:
                table = DiningTable.objects.get(id=data["table_id"])
            except (DiningTable.DoesNotExist, ValueError):
                raise ValidationError(
                    {"table_id": ["Invalid reference - object does not exist."]},
                    code="INVALID_REFERENCE",
                ) from None
            verify_tenant_and_branch_access(request.user, table)

        target_type = data.get("target_type", "TABLE")
        existing_qr = QRCode.objects.filter(
            branch=branch,
            target_type=target_type,
            table=table,
            is_active=True,
        ).first()
        if existing_qr:
            return Response(QRCodeSerializer(existing_qr).data, status=status.HTTP_200_OK)

        qr = generate_qr_code(
            branch=branch,
            target_type=target_type,
            table=table,
            actor=request.user,
            request=request,
        )
        return Response(QRCodeSerializer(qr).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="rotate")
    def rotate(self, request: Request, pk: str | None = None) -> Response:
        qr = self.get_object()
        qr = rotate_qr_code(qr_code=qr, actor=request.user, request=request)
        return Response(QRCodeSerializer(qr).data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request: Request, pk: str | None = None) -> Response:
        qr = self.get_object()
        deactivate_qr_code(qr_code=qr, actor=request.user, request=request)
        return Response({"detail": "QR code deactivated successfully."})

    @action(
        detail=True,
        methods=["get"],
        url_path="image",
        renderer_classes=[PNGRenderer, SVGRenderer],
    )
    def image(self, request: Request, pk: str | None = None) -> HttpResponse:
        qr = self.get_object()
        image_format = request.query_params.get("format", "png")
        image_bytes, content_type = render_qr_image(qr, image_format=image_format)
        return HttpResponse(image_bytes, content_type=content_type)


class PublicQRDetailView(APIView):
    """Public unauthenticated endpoint to resolve a scanned QR code token."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request: Request, token: str) -> Response:
        qr = get_public_qr_code(token)
        if not qr:
            raise Http404("QR code is invalid or deactivated.")

        tenant = qr.branch.tenant
        if not is_tenant_allowed(tenant):
            raise Http404("Venue is currently unavailable.")

        # Establish request-scoped tenant context
        set_current_tenant(tenant)
        request.tenant = tenant  # type: ignore[attr-defined]

        capabilities = getattr(qr.branch, "capabilities", None)
        active_session = (
            TableSession.objects.filter(table=qr.table, status=SessionStatus.OPEN).first()
            if qr.table
            else None
        )

        can_open = False
        requires_staff = False
        ordering_mode = QROrderingMode.ORDER_WITH_APPROVAL

        if capabilities:
            ordering_mode = capabilities.qr_ordering_mode
            if (
                capabilities.qr_session_policy == QRSessionPolicy.CUSTOMER_CAN_OPEN
                and capabilities.allows_qr_ordering
            ):
                can_open = True
            elif capabilities.qr_session_policy == QRSessionPolicy.STAFF_ONLY:
                requires_staff = True

        business_settings = getattr(tenant, "business_settings", None)
        logo_url = business_settings.logo_url if business_settings else ""

        payload = {
            "tenant_name": tenant.name,
            "tenant_logo_url": logo_url,
            "branch_name": qr.branch.name,
            "area_name": (
                qr.table.section.service_area.name
                if (qr.table and qr.table.section and qr.table.section.service_area)
                else ""
            ),
            "table_label": qr.table.label if qr.table else "",
            "ordering_mode": ordering_mode,
            "active_session_status": active_session.status if active_session else None,
            "can_open_session": can_open,
            "open_table_requires_staff": requires_staff,
        }
        return Response(PublicQRDetailSerializer(payload).data)


class PublicQROpenSessionView(APIView):
    """Public unauthenticated endpoint for diner to open or rejoin a table session."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request: Request, token: str) -> Response:
        qr = get_public_qr_code(token)
        if not qr or not qr.table:
            raise Http404("QR code is invalid or not associated with a dining table.")

        tenant = qr.branch.tenant
        if not is_tenant_allowed(tenant):
            raise Http404("Venue is currently unavailable.")

        # Establish request-scoped tenant context
        set_current_tenant(tenant)
        request.tenant = tenant  # type: ignore[attr-defined]

        capabilities = getattr(qr.branch, "capabilities", None)
        if capabilities and (
            capabilities.qr_session_policy == QRSessionPolicy.STAFF_ONLY
            or not capabilities.allows_qr_ordering
        ):
            return Response(
                {
                    "detail": "This table requires staff to open a session.",
                    "code": "STAFF_ACTION_REQUIRED",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PublicQROpenSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guest_count = serializer.validated_data.get("guest_count", 1)

        # Check if table already has an active session (multi-diner rejoin)
        existing_session = TableSession.objects.filter(
            table=qr.table,
            status=SessionStatus.OPEN,
        ).first()

        http_status: int = status.HTTP_200_OK
        if existing_session:
            session = existing_session
        else:
            session = open_session(
                branch=qr.branch,
                table=qr.table,
                opened_via=OpenedVia.QR_CUSTOMER,
                guest_count=guest_count,
                actor=None,
                request=request,
            )
            http_status = status.HTTP_201_CREATED

        signer = TimestampSigner(salt="qr-session")
        session_token = signer.sign(session.session_code)

        response_data = {
            "session_code": session.session_code,
            "session_token": session_token,
            "status": session.status,
            "guest_count": session.guest_count,
        }
        return Response(
            PublicQROpenSessionResponseSerializer(response_data).data, status=http_status
        )
