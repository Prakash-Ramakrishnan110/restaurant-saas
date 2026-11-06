from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.venues.constants import (
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
)


class BranchCapabilitiesSerializer(serializers.ModelSerializer[BranchCapabilities]):
    class Meta:
        model = BranchCapabilities
        fields = [
            "id",
            "branch",
            "uses_tables",
            "uses_kds",
            "uses_token_numbers",
            "allows_takeaway",
            "allows_room_service",
            "allows_room_charge",
            "allows_qr_ordering",
            "has_sections",
            "has_seat_ordering",
            "supports_courses",
            "allows_table_transfer",
            "payment_timing",
            "qr_ordering_mode",
            "qr_session_policy",
            "order_workflow",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "branch", "created_at", "updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        combined: dict[str, Any] = {}
        if isinstance(self.instance, BranchCapabilities):
            combined = {
                "uses_tables": self.instance.uses_tables,
                "uses_kds": self.instance.uses_kds,
                "uses_token_numbers": self.instance.uses_token_numbers,
                "allows_takeaway": self.instance.allows_takeaway,
                "allows_room_service": self.instance.allows_room_service,
                "allows_room_charge": self.instance.allows_room_charge,
                "allows_qr_ordering": self.instance.allows_qr_ordering,
                "has_sections": self.instance.has_sections,
                "has_seat_ordering": self.instance.has_seat_ordering,
                "supports_courses": self.instance.supports_courses,
                "allows_table_transfer": self.instance.allows_table_transfer,
                "payment_timing": self.instance.payment_timing,
                "qr_ordering_mode": self.instance.qr_ordering_mode,
                "qr_session_policy": self.instance.qr_session_policy,
                "order_workflow": self.instance.order_workflow,
            }
        combined.update(attrs)
        from apps.venues.services import validate_capabilities

        validate_capabilities(combined)
        return attrs


class ServiceAreaSerializer(serializers.ModelSerializer[ServiceArea]):
    class Meta:
        model = ServiceArea
        fields = [
            "id",
            "branch",
            "name",
            "area_type",
            "service_charge_bps",
            "is_active",
            "sort_order",
            "operating_hours",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SectionSerializer(serializers.ModelSerializer[Section]):
    class Meta:
        model = Section
        fields = [
            "id",
            "branch",
            "service_area",
            "name",
            "section_type",
            "is_active",
            "color",
            "canvas_width",
            "canvas_height",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        inst = self.instance if isinstance(self.instance, Section) else None
        branch = attrs.get("branch") or (inst.branch if inst else None)
        service_area = attrs.get("service_area") or (inst.service_area if inst else None)
        if branch and service_area and service_area.branch_id != branch.id:
            raise serializers.ValidationError(
                {"service_area": ["Invalid reference - object does not exist."]},
                code="does_not_exist",
            )
        return attrs


class DiningTableSerializer(serializers.ModelSerializer[DiningTable]):
    active_session_code = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = DiningTable
        fields = [
            "id",
            "branch",
            "section",
            "label",
            "table_type",
            "min_capacity",
            "capacity",
            "status",
            "is_combinable",
            "is_active",
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "shape",
            "group",
            "active_session_code",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "group", "created_at", "updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        inst = self.instance if isinstance(self.instance, DiningTable) else None
        branch = attrs.get("branch") or (inst.branch if inst else None)
        section = attrs.get("section") or (inst.section if inst else None)
        if branch and section and section.branch_id != branch.id:
            raise serializers.ValidationError(
                {"section": ["Invalid reference - object does not exist."]},
                code="does_not_exist",
            )
        if section and not section.is_active:
            raise serializers.ValidationError(
                {"section": ["Cannot add or move table to an inactive section."]},
                code="INACTIVE_SECTION",
            )
        label = attrs.get("label")
        if branch and label and (inst is None or label != inst.label):
            from apps.venues.services import assert_table_label_free

            assert_table_label_free(branch, label, exclude_id=inst.pk if inst else None)
        return attrs

    def get_active_session_code(self, obj: DiningTable) -> str | None:
        session = obj.sessions.filter(status=SessionStatus.OPEN).first()
        return session.session_code if session else None


class TableStatusTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TableStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class TableJoinSerializer(serializers.Serializer):
    table_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=2,
        allow_empty=False,
    )
    label: serializers.CharField = serializers.CharField(  # type: ignore[assignment]
        max_length=100, required=False, allow_blank=True
    )


class TableSplitSerializer(serializers.Serializer):
    group_id = serializers.UUIDField()


class BulkTableCreateSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    section_id = serializers.UUIDField()
    prefix = serializers.CharField(max_length=10, default="T")
    start_number = serializers.IntegerField(default=1, min_value=1)
    count = serializers.IntegerField(default=1, min_value=1, max_value=100)
    capacity = serializers.IntegerField(default=4, min_value=1)
    table_type = serializers.ChoiceField(choices=TableType.choices, default=TableType.TABLE)
    shape = serializers.ChoiceField(choices=TableShape.choices, default=TableShape.SQUARE)


class TableLayoutItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    x = serializers.FloatField(required=False)
    y = serializers.FloatField(required=False)
    width = serializers.FloatField(required=False)
    height = serializers.FloatField(required=False)
    rotation = serializers.IntegerField(required=False)
    shape = serializers.ChoiceField(choices=TableShape.choices, required=False)


class TableLayoutUpdateSerializer(serializers.Serializer):
    tables = serializers.ListField(child=TableLayoutItemSerializer(), allow_empty=False)


class TableGroupSerializer(serializers.ModelSerializer[TableGroup]):
    table_ids: Any = serializers.PrimaryKeyRelatedField(many=True, read_only=True, source="tables")

    class Meta:
        model = TableGroup
        fields = ["id", "branch", "label", "is_active", "table_ids", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class StaffSectionAssignmentSerializer(serializers.ModelSerializer[StaffSectionAssignment]):
    user_email = serializers.EmailField(source="membership.user.email", read_only=True)
    user_name = serializers.CharField(source="membership.user.full_name", read_only=True)

    class Meta:
        model = StaffSectionAssignment
        fields = [
            "id",
            "branch",
            "membership",
            "section",
            "user_email",
            "user_name",
            "valid_from",
            "valid_to",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TableSessionSerializer(serializers.ModelSerializer[TableSession]):
    table_label = serializers.CharField(source="table.label", read_only=True)
    opened_by_email = serializers.EmailField(source="opened_by.user.email", read_only=True)

    class Meta:
        model = TableSession
        fields = [
            "id",
            "branch",
            "table",
            "table_group",
            "table_label",
            "status",
            "opened_via",
            "opened_by",
            "opened_by_email",
            "guest_count",
            "session_code",
            "opened_at",
            "closed_at",
            "last_activity_at",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "branch",
            "table",
            "table_group",
            "guest_count",
            "session_code",
            "status",
            "opened_via",
            "opened_by",
            "opened_at",
            "closed_at",
            "last_activity_at",
            "expires_at",
            "created_at",
            "updated_at",
        ]


class OpenSessionSerializer(serializers.Serializer):
    table_id = serializers.UUIDField(required=False, allow_null=True)
    table_group_id = serializers.UUIDField(required=False, allow_null=True)
    guest_count = serializers.IntegerField(default=1, min_value=1)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs.get("table_id") and not attrs.get("table_group_id"):
            raise serializers.ValidationError("Either table_id or table_group_id is required.")
        return attrs


class QRCodeSerializer(serializers.ModelSerializer[QRCode]):
    table_label = serializers.CharField(source="table.label", read_only=True)
    service_area_name = serializers.CharField(source="service_area.name", read_only=True)

    class Meta:
        model = QRCode
        fields = [
            "id",
            "branch",
            "target_type",
            "table",
            "table_label",
            "service_area",
            "service_area_name",
            "public_token",
            "is_active",
            "version",
            "rotated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "branch",
            "target_type",
            "table",
            "service_area",
            "public_token",
            "is_active",
            "version",
            "rotated_at",
            "created_at",
            "updated_at",
        ]


class GenerateQRCodeSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    table_id = serializers.UUIDField(required=False, allow_null=True)
    service_area_id = serializers.UUIDField(required=False, allow_null=True)
    target_type = serializers.ChoiceField(choices=QRTargetType.choices, default=QRTargetType.TABLE)


class PublicQRDetailSerializer(serializers.Serializer):
    tenant_name = serializers.CharField()
    display_name = serializers.CharField()
    tenant_logo_url = serializers.CharField(allow_blank=True)
    logo_url = serializers.CharField(allow_blank=True)
    brand_primary_color = serializers.CharField(default="#FF6A00")
    branch_name = serializers.CharField()
    area_name = serializers.CharField(allow_blank=True)
    table_label = serializers.CharField(allow_blank=True)
    ordering_mode = serializers.CharField()
    active_session_status = serializers.CharField(allow_null=True)
    can_open_session = serializers.BooleanField()
    open_table_requires_staff = serializers.BooleanField()


class PublicQROpenSessionSerializer(serializers.Serializer):
    guest_count = serializers.IntegerField(default=1, min_value=1)


class PublicQROpenSessionResponseSerializer(serializers.Serializer):
    session_code = serializers.CharField()
    session_token = serializers.CharField()
    status = serializers.CharField()
    guest_count = serializers.IntegerField()


class QRCodeSheetItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    public_token = serializers.CharField()
    target_type = serializers.CharField()
    label = serializers.CharField(allow_blank=True)  # type: ignore[assignment]
    area_name = serializers.CharField(allow_blank=True)
    section_name = serializers.CharField(allow_blank=True)
    branch_id = serializers.CharField()
    branch_name = serializers.CharField()
    public_url = serializers.CharField()


class LayoutTemplateCatalogItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    recommended_profiles = serializers.ListField(child=serializers.CharField())
    has_tables = serializers.BooleanField()
    params_schema = serializers.DictField()


class LayoutTemplateApplyResponseSerializer(serializers.Serializer):
    dry_run = serializers.BooleanField()
    template_key = serializers.CharField()
    mode = serializers.CharField()
    would_create = serializers.DictField(required=False)
    created = serializers.DictField(required=False)
    plan_allows = serializers.BooleanField(required=False)
    limits = serializers.DictField(required=False)
