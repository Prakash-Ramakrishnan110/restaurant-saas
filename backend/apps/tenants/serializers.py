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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "subscription_status",
            "suggested_venue_profile",
        )

    def get_suggested_venue_profile(self, obj: Tenant) -> str:
        from apps.venues.presets import suggest_venue_profile

        return suggest_venue_profile(obj.business_type)


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
