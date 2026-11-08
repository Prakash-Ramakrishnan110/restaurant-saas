from typing import Any

from rest_framework import serializers

from apps.tenants.color_utils import validate_brand_primary_color, validate_gstin
from apps.tenants.models import Branch, BusinessSettings, Tenant


class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = (
            "tax_mode",
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
        )


class BusinessLogoResponseSerializer(serializers.Serializer):
    logo_url = serializers.CharField(allow_blank=True)
    logo_128_url = serializers.CharField(allow_blank=True)


class BusinessProfileSerializer(serializers.ModelSerializer):
    invoice_prefix = serializers.CharField(
        source="business_settings.invoice_prefix", required=False, allow_blank=True
    )
    logo_url = serializers.CharField(
        source="business_settings.logo_url", required=False, allow_blank=True
    )
    logo_128_url = serializers.CharField(
        source="business_settings.logo_128_url", required=False, allow_blank=True, read_only=True
    )
    primary_color = serializers.CharField(
        source="business_settings.primary_color", required=False, allow_blank=True
    )
    brand_primary_color = serializers.CharField(
        source="business_settings.brand_primary_color", required=False, allow_blank=True
    )
    legal_name = serializers.CharField(
        source="business_settings.legal_name", required=False, allow_blank=True
    )
    gstin = serializers.CharField(
        source="business_settings.gstin", required=False, allow_blank=True
    )
    registered_address = serializers.CharField(
        source="business_settings.registered_address", required=False, allow_blank=True
    )
    document_language = serializers.ChoiceField(
        choices=BusinessSettings.DocumentLanguage.choices,
        source="business_settings.document_language",
        required=False,
    )
    receipt_footer_text = serializers.CharField(
        source="business_settings.receipt_footer_text",
        required=False,
        allow_blank=True,
        max_length=200,
    )
    tax_mode = serializers.ChoiceField(
        choices=BusinessSettings.TaxMode.choices,
        source="business_settings.tax_mode",
        required=False,
    )
    subscription_status = serializers.CharField(source="subscription.status", read_only=True)

    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
            "business_type",
            "status",
            "subscription_status",
            "email",
            "phone",
            "timezone",
            "currency",
            "address",
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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "slug",
            "status",
            "subscription_status",
            "currency",
            "logo_128_url",
            "created_at",
            "updated_at",
        )

    def validate_brand_primary_color(self, value: str) -> str:
        if value:
            return validate_brand_primary_color(value)
        return value

    def validate_gstin(self, value: str) -> str:
        if value:
            return validate_gstin(value)
        return value


class TenantSerializer(serializers.ModelSerializer):
    business_settings = BusinessSettingsSerializer(read_only=True)
    subscription_status = serializers.CharField(source="subscription.status", read_only=True)
    suggested_venue_profile = serializers.SerializerMethodField()
    branches_count = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
            "business_type",
            "suggested_venue_profile",
            "status",
            "email",
            "phone",
            "address",
            "timezone",
            "currency",
            "business_settings",
            "subscription_status",
            "branches_count",
            "plan_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "subscription_status",
            "suggested_venue_profile",
            "branches_count",
            "plan_name",
        )

    def get_suggested_venue_profile(self, obj: Tenant) -> str:
        from apps.venues.presets import suggest_venue_profile

        return suggest_venue_profile(obj.business_type)

    def get_branches_count(self, obj: Tenant) -> int:
        return obj.get_branches_count()

    def get_plan_name(self, obj: Tenant) -> str:
        sub = getattr(obj, "subscription", None)
        if sub and sub.plan:
            return sub.plan.name
        return "Trial"


class TenantDetailSerializer(serializers.ModelSerializer):
    business_settings = BusinessSettingsSerializer(read_only=True)
    suggested_venue_profile = serializers.SerializerMethodField()
    branches = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
            "business_type",
            "suggested_venue_profile",
            "status",
            "email",
            "phone",
            "address",
            "timezone",
            "currency",
            "business_settings",
            "branches",
            "owner",
            "subscription",
            "notes",
            "recent_activity",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_suggested_venue_profile(self, obj: Tenant) -> str:
        from apps.venues.presets import suggest_venue_profile

        return suggest_venue_profile(obj.business_type)

    def get_branches(self, obj: Tenant) -> Any:
        return BranchSerializer(obj.get_branches_list(), many=True).data

    def get_owner(self, obj: Tenant) -> dict | None:
        from apps.accounts.models import Membership
        from apps.rbac.constants import Role

        membership = (
            Membership.objects.filter(tenant=obj, role=Role.OWNER, is_active=True)
            .select_related("user")
            .first()
        )
        if not membership or not membership.user:
            return None
        return {
            "id": str(membership.user.id),
            "email": membership.user.email,
            "full_name": membership.user.full_name,
            "phone": getattr(membership.user, "phone_number", "") or obj.phone,
            "is_active": membership.user.is_active,
        }

    def get_subscription(self, obj: Tenant) -> dict | None:
        from django.utils import timezone

        sub = getattr(obj, "subscription", None)
        if not sub:
            return None
        trial_days_remaining = None
        if sub.status == "TRIAL" and sub.ends_at:
            trial_days_remaining = max(0, (sub.ends_at - timezone.now()).days)
        return {
            "status": sub.status,
            "plan_name": sub.plan.name if sub.plan else "Starter Plan",
            "plan_slug": sub.plan.slug if sub.plan else "starter",
            "price_paise": sub.plan.price_paise if sub.plan else 0,
            "starts_at": sub.starts_at.isoformat() if sub.starts_at else None,
            "ends_at": sub.ends_at.isoformat() if sub.ends_at else None,
            "trial_days_remaining": trial_days_remaining,
            "entitlements": sub.plan.entitlements if sub.plan else {},
        }

    def get_notes(self, obj: Tenant) -> list[dict]:
        from apps.audit.models import AuditLog

        logs = (
            AuditLog.objects.filter(
                entity_type="Tenant",
                entity_id=str(obj.id),
                action="tenant.add_note",
            )
            .select_related("actor")
            .order_by("-timestamp")
        )
        return [
            {
                "id": str(log.id),
                "note": log.after_state.get("note", "") if log.after_state else "",
                "reason": log.after_state.get("reason", "") if log.after_state else "",
                "author": (
                    log.actor.full_name
                    if log.actor
                    else (log.after_state.get("author", "System") if log.after_state else "System")
                ),
                "timestamp": log.timestamp.isoformat(),
            }
            for log in logs
        ]

    def get_recent_activity(self, obj: Tenant) -> list[dict]:
        from apps.audit.models import AuditLog

        logs = (
            AuditLog.objects.filter(
                entity_type="Tenant",
                entity_id=str(obj.id),
            )
            .select_related("actor")
            .order_by("-timestamp")[:15]
        )
        return [
            {
                "id": str(log.id),
                "action": log.action,
                "actor": log.actor.full_name if log.actor else "System",
                "details": log.after_state or {},
                "timestamp": log.timestamp.isoformat(),
            }
            for log in logs
        ]


class PlatformCustomerCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    business_type = serializers.ChoiceField(
        choices=Tenant.BusinessType.choices,
        default=Tenant.BusinessType.RESTAURANT,
    )
    city = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    language = serializers.ChoiceField(choices=["en", "ta"], default="en")
    owner_name = serializers.CharField(max_length=255)
    owner_phone = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    owner_email = serializers.EmailField()
    plan_slug = serializers.ChoiceField(
        choices=["starter", "professional", "business", "enterprise"],
        default="starter",
    )
    trial_days = serializers.IntegerField(default=14, min_value=1, max_value=90)
    outlets_count = serializers.IntegerField(default=1, min_value=1, max_value=50)
    outlet_names = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )


class TenantCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255, required=False)
    business_type = serializers.ChoiceField(
        choices=Tenant.BusinessType.choices,
        default=Tenant.BusinessType.RESTAURANT,
        required=False,
    )
    email = serializers.EmailField(required=False, default="")
    phone = serializers.CharField(max_length=32, required=False, default="")
    address = serializers.CharField(required=False, allow_blank=True, default="")
    timezone = serializers.CharField(max_length=64, default="Asia/Kolkata")
    currency = serializers.CharField(max_length=10, default="INR")
    owner_email = serializers.EmailField()
    owner_full_name = serializers.CharField(max_length=255)
    owner_password = serializers.CharField(write_only=True, required=False, default="")


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = (
            "id",
            "name",
            "address",
            "phone",
            "venue_profile",
            "is_active",
            "operating_hours",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class BranchCreateUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    address = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    venue_profile = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)
    operating_hours = serializers.DictField(required=False, default=dict)


class OnboardingStatusSerializer(serializers.Serializer):
    is_complete = serializers.BooleanField()
    next_step = serializers.CharField(allow_null=True)
    steps = serializers.DictField(child=serializers.BooleanField())
    details = serializers.DictField()
