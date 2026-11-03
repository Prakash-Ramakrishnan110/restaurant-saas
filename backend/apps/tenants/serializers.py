from rest_framework import serializers

from apps.tenants.models import Branch, BusinessSettings, Tenant


class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = ("tax_mode", "invoice_prefix", "logo_url", "primary_color")


class TenantSerializer(serializers.ModelSerializer):
    business_settings = BusinessSettingsSerializer(read_only=True)
    subscription_status = serializers.CharField(source="subscription.status", read_only=True)

    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
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
        read_only_fields = ("id", "created_at", "updated_at", "subscription_status")


class TenantCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255, required=False)
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
    is_active = serializers.BooleanField(default=True)
    operating_hours = serializers.DictField(required=False, default=dict)
