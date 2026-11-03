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
            "uses_token_numbers",
            "uses_kds",
            "uses_courses",
            "allows_takeaway",
            "allows_room_service",
            "allows_qr_ordering",
            "payment_timing",
            "qr_ordering_mode",
            "qr_session_policy",
            "order_workflow",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "branch", "created_at", "updated_at"]


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
            "color",
            "canvas_width",
            "canvas_height",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DiningTableSerializer(serializers.ModelSerializer[DiningTable]):
    active_session_code = serializers.SerializerMethodField()

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

    class Meta:
        model = QRCode
        fields = [
            "id",
            "branch",
            "target_type",
            "table",
            "table_label",
            "public_token",
            "is_active",
            "version",
            "rotated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_token",
            "version",
            "rotated_at",
            "created_at",
            "updated_at",
        ]


class GenerateQRCodeSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    table_id = serializers.UUIDField(required=False, allow_null=True)
    target_type = serializers.ChoiceField(choices=QRTargetType.choices, default=QRTargetType.TABLE)


class PublicQRDetailSerializer(serializers.Serializer):
    tenant_name = serializers.CharField()
    tenant_logo_url = serializers.CharField(allow_blank=True)
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
