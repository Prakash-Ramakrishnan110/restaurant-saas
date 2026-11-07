from django.utils import timezone
from rest_framework import serializers

from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderEvent,
    OrderItem,
    OrderWorkflow,
    PaymentMethod,
    ServiceRequest,
    ServiceRequestType,
)


class OrderItemSerializer(serializers.ModelSerializer[OrderItem]):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item_id",
            "item_name",
            "quantity",
            "unit_price_paise",
            "subtotal_paise",
            "course",
            "is_fired",
            "station",
            "notes",
            "status",
        ]


class OrderEventSerializer(serializers.ModelSerializer[OrderEvent]):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderEvent
        fields = [
            "id",
            "event_type",
            "from_status",
            "to_status",
            "created_at",
            "user_name",
            "notes",
        ]

    def get_user_name(self, obj: OrderEvent) -> str:
        if obj.user and getattr(obj.user, "user", None):
            return obj.user.user.full_name
        return "System"


class OrderSerializer(serializers.ModelSerializer[Order]):
    items = OrderItemSerializer(many=True, read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    table_label = serializers.SerializerMethodField()
    total_paise = serializers.ReadOnlyField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "branch_id",
            "table_session_id",
            "table_label",
            "order_workflow",
            "token_number",
            "status",
            "placed_at",
            "ready_at",
            "served_at",
            "notes",
            "items",
            "events",
            "total_paise",
        ]

    def get_table_label(self, obj: Order) -> str | None:
        if obj.table_session and obj.table_session.table:
            return obj.table_session.table.label
        if obj.token_number:
            return f"Token #{obj.token_number}"
        return None


class CreateOrderItemInputSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    course = serializers.ChoiceField(choices=CourseType.choices, default=CourseType.MAIN)
    is_fired = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CreateOrderSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField(required=False)
    table_session_id = serializers.UUIDField(required=False, allow_null=True)
    token_number = serializers.IntegerField(required=False, allow_null=True)
    order_workflow = serializers.ChoiceField(
        choices=OrderWorkflow.choices, default=OrderWorkflow.TABLE_SERVICE
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = CreateOrderItemInputSerializer(many=True)


class KDSTicketSerializer(serializers.ModelSerializer[Order]):
    items = OrderItemSerializer(many=True, read_only=True)
    table_label = serializers.SerializerMethodField()
    elapsed_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "branch_id",
            "table_session_id",
            "table_label",
            "order_workflow",
            "token_number",
            "status",
            "placed_at",
            "elapsed_minutes",
            "notes",
            "items",
        ]

    def get_table_label(self, obj: Order) -> str:
        if obj.table_session and obj.table_session.table:
            return f"Table {obj.table_session.table.label}"
        if obj.token_number:
            return f"Token #{obj.token_number}"
        return "Counter Order"

    def get_elapsed_minutes(self, obj: Order) -> int:
        now = timezone.now()
        diff = now - obj.placed_at
        return int(diff.total_seconds() // 60)


class BillInvoiceSerializer(serializers.ModelSerializer[BillInvoice]):
    table_label = serializers.SerializerMethodField()

    class Meta:
        model = BillInvoice
        fields = [
            "id",
            "branch_id",
            "table_session_id",
            "table_label",
            "invoice_number",
            "subtotal_paise",
            "discount_paise",
            "total_paise",
            "snapshot_lines",
            "payment_method",
            "amount_tendered_paise",
            "change_due_paise",
            "is_settled",
            "settled_at",
            "notes",
        ]

    def get_table_label(self, obj: BillInvoice) -> str:
        if obj.table_session and obj.table_session.table:
            return obj.table_session.table.label
        return "Counter"


class SettleBillSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    amount_tendered_paise = serializers.IntegerField(required=False, min_value=0)
    discount_paise = serializers.IntegerField(required=False, default=0, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceRequestSerializer(serializers.ModelSerializer[ServiceRequest]):
    table_label = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "branch_id",
            "table_id",
            "table_session_id",
            "table_label",
            "request_type",
            "status",
            "created_at",
            "acknowledged_at",
        ]

    def get_table_label(self, obj: ServiceRequest) -> str:
        return obj.table.label if obj.table else "N/A"
