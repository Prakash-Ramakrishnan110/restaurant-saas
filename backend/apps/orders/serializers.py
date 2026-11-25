from django.utils import timezone
from rest_framework import serializers

from apps.orders.models import (
    BillInvoice,
    CashierShiftCloseout,
    CashMovement,
    CashMovementType,
    CourseType,
    Customer,
    InvoiceRefund,
    Order,
    OrderEvent,
    OrderFeedback,
    OrderItem,
    OrderWorkflow,
    PaymentMethod,
    RefundReasonCode,
    RefundRestockAction,
    ServiceRequest,
    ShiftStatus,
    VarianceReasonCode,
)


class OrderItemSerializer(serializers.ModelSerializer[OrderItem]):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item_id",
            "item_name",
            "variant_name",
            "options_snapshot",
            "quantity",
            "unit_price_paise",
            "subtotal_paise",
            "course",
            "seat_number",
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
            "source",
            "token_number",
            "status",
            "source",
            "payment_status",
            "rejected_reason",
            "placed_at",
            "ready_at",
            "last_called_at",
            "call_count",
            "served_at",
            "completed_at",
            "cancelled_at",
            "guest_label",
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
    seat_number = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    is_fired = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CreateOrderSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField(required=False)
    table_session_id = serializers.UUIDField(required=False, allow_null=True)
    token_number = serializers.IntegerField(required=False, allow_null=True)
    order_workflow = serializers.ChoiceField(
        choices=OrderWorkflow.choices, default=OrderWorkflow.TABLE_SERVICE
    )
    idempotency_key = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=128
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
            "source",
            "token_number",
            "status",
            "placed_at",
            "ready_at",
            "last_called_at",
            "call_count",
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


class InvoiceRefundSerializer(serializers.ModelSerializer[InvoiceRefund]):
    processed_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)

    class Meta:
        model = InvoiceRefund
        fields = [
            "id",
            "branch_id",
            "invoice_id",
            "invoice_number",
            "refund_number",
            "amount_paise",
            "reason_code",
            "refund_method",
            "restock_action",
            "refunded_lines",
            "notes",
            "processed_by_name",
            "approved_by_name",
            "created_at",
        ]

    def get_processed_by_name(self, obj: InvoiceRefund) -> str:
        if obj.processed_by and getattr(obj.processed_by, "user", None):
            return obj.processed_by.user.full_name
        return "Staff"

    def get_approved_by_name(self, obj: InvoiceRefund) -> str | None:
        if obj.approved_by and getattr(obj.approved_by, "user", None):
            return obj.approved_by.user.full_name
        return None


class CreateInvoiceRefundSerializer(serializers.Serializer):
    amount_paise = serializers.IntegerField(min_value=1)
    reason_code = serializers.ChoiceField(choices=RefundReasonCode.choices)
    refund_method = serializers.ChoiceField(
        choices=PaymentMethod.choices, required=False, allow_null=True
    )
    restock_action = serializers.ChoiceField(
        choices=RefundRestockAction.choices, default=RefundRestockAction.NONE
    )
    refunded_lines = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CashMovementSerializer(serializers.ModelSerializer[CashMovement]):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashMovement
        fields = [
            "id",
            "shift_id",
            "movement_type",
            "amount_paise",
            "reason",
            "recorded_by_name",
            "created_at",
        ]

    def get_recorded_by_name(self, obj: CashMovement) -> str:
        if obj.recorded_by and getattr(obj.recorded_by, "user", None):
            return obj.recorded_by.user.full_name
        return "Staff"


class CreateCashMovementSerializer(serializers.Serializer):
    movement_type = serializers.ChoiceField(choices=CashMovementType.choices)
    amount_paise = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255)


class CashierShiftCloseoutSerializer(serializers.ModelSerializer[CashierShiftCloseout]):
    cashier_name = serializers.SerializerMethodField()
    cash_movements = CashMovementSerializer(many=True, read_only=True)
    expected_cash_paise = serializers.SerializerMethodField()
    cash_variance_paise = serializers.SerializerMethodField()

    class Meta:
        model = CashierShiftCloseout
        fields = [
            "id",
            "branch_id",
            "cashier_name",
            "status",
            "is_locked",
            "opened_at",
            "closed_at",
            "opening_cash_paise",
            "cash_sales_paise",
            "cash_in_paise",
            "cash_out_paise",
            "cash_refunds_paise",
            "expected_cash_paise",
            "actual_cash_paise",
            "cash_variance_paise",
            "variance_threshold_paise",
            "variance_reason_code",
            "denominations_snapshot",
            "upi_total_paise",
            "card_total_paise",
            "total_settled_paise",
            "total_invoices_count",
            "notes",
            "cash_movements",
        ]

    def get_cashier_name(self, obj: CashierShiftCloseout) -> str:
        if obj.cashier and getattr(obj.cashier, "user", None):
            return obj.cashier.user.full_name
        return "Cashier"

    def get_expected_cash_paise(self, obj: CashierShiftCloseout) -> int | None:
        # Enforce blind count: do not reveal expected cash while shift is OPEN
        if obj.status == ShiftStatus.OPEN and not obj.is_locked:
            return None
        return obj.expected_cash_paise

    def get_cash_variance_paise(self, obj: CashierShiftCloseout) -> int | None:
        if obj.status == ShiftStatus.OPEN and not obj.is_locked:
            return None
        return obj.cash_variance_paise


class CloseShiftInputSerializer(serializers.Serializer):
    actual_cash_paise = serializers.IntegerField(min_value=0)
    opening_cash_paise = serializers.IntegerField(min_value=0, required=False)
    denominations_snapshot = serializers.DictField(
        child=serializers.IntegerField(min_value=0), required=False, default=dict
    )
    variance_reason_code = serializers.ChoiceField(
        choices=VarianceReasonCode.choices, required=False, allow_blank=True, default=""
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BillInvoiceSerializer(serializers.ModelSerializer[BillInvoice]):
    table_label = serializers.SerializerMethodField()
    refunded_paise = serializers.ReadOnlyField()
    net_total_paise = serializers.ReadOnlyField()
    refunds = InvoiceRefundSerializer(many=True, read_only=True)

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
            "refunded_paise",
            "net_total_paise",
            "snapshot_lines",
            "payment_method",
            "amount_tendered_paise",
            "change_due_paise",
            "is_settled",
            "settled_at",
            "notes",
            "refunds",
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
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    redeem_loyalty_points = serializers.IntegerField(required=False, default=0, min_value=0)
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


class CustomerSerializer(serializers.ModelSerializer[Customer]):
    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "consent_given",
            "dietary_preference",
            "allergies",
            "notes",
            "visit_count",
            "total_spend_paise",
            "loyalty_points",
            "lifetime_points_earned",
            "lifetime_points_redeemed",
            "last_visit_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "lifetime_points_earned",
            "lifetime_points_redeemed",
            "created_at",
        ]


class OrderFeedbackSerializer(serializers.ModelSerializer[OrderFeedback]):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = OrderFeedback
        fields = [
            "id",
            "order_id",
            "order_number",
            "branch_id",
            "branch_name",
            "food_rating",
            "service_rating",
            "item_ratings",
            "comment",
            "suggestion_type",
            "is_hidden",
            "is_resolved",
            "owner_note",
            "created_at",
        ]
        read_only_fields = ["id", "order_id", "branch_id", "created_at"]
