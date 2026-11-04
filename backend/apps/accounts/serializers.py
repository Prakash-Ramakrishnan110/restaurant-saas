from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Membership
from apps.rbac.constants import Role
from apps.tenants.models import Branch

User = get_user_model()


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone",
            "is_platform_admin",
            "must_change_password",
            "created_at",
        )
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)

    def validate_old_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value: str) -> str:
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        user = self.context["request"].user
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class BranchSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "name", "is_active")


class MembershipSummarySerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_slug = serializers.CharField(source="tenant.slug", read_only=True)
    tenant_status = serializers.CharField(source="tenant.status", read_only=True)
    branches = BranchSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "tenant_id",
            "tenant_name",
            "tenant_slug",
            "tenant_status",
            "role",
            "branches",
            "is_active",
        )


class AuthMeResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    memberships = MembershipSummarySerializer(many=True)
    active_tenant_id = serializers.UUIDField(allow_null=True)
    active_role = serializers.CharField(allow_null=True)
    permissions = serializers.ListField(child=serializers.CharField())


class LoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    user = UserSerializer()
    active_tenant_id = serializers.UUIDField(allow_null=True)
    memberships = MembershipSummarySerializer(many=True)


class StaffCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, default="")
    role = serializers.ChoiceField(choices=Role.CHOICES)
    branch_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    is_active = serializers.BooleanField(default=True)


class StaffUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.CHOICES, required=False)
    branch_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
    )
    is_active = serializers.BooleanField(required=False)


class StaffDetailSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    branches = BranchSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "user", "role", "branches", "is_active", "created_at")
