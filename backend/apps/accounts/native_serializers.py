from rest_framework import serializers

from apps.accounts.models import StaffDevice
from apps.accounts.serializers import MembershipSummarySerializer, UserSerializer


class NativeLoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    device_id = serializers.CharField(max_length=128)
    app_version = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    device_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )


class NativeLoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()
    active_tenant_id = serializers.UUIDField(allow_null=True)
    memberships = MembershipSummarySerializer(many=True)
    device_id = serializers.CharField()


class NativeRefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class NativeRefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class NativeLogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, default="")
    device_id = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")


class StaffDeviceUpsertSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=128)
    device_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    app_version = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    push_token = serializers.CharField(
        max_length=512, required=False, allow_null=True, allow_blank=True
    )
    push_enabled = serializers.BooleanField(required=False)


class StaffDevicePublicSerializer(serializers.ModelSerializer[StaffDevice]):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    short_device_id = serializers.SerializerMethodField()

    class Meta:
        model = StaffDevice
        fields = (
            "id",
            "user_id",
            "user_email",
            "user_full_name",
            "short_device_id",
            "platform",
            "device_name",
            "app_version",
            "push_enabled",
            "last_seen_at",
            "revoked_at",
            "revoked_reason",
            "created_at",
        )

    def get_short_device_id(self, obj: StaffDevice) -> str:
        return obj.device_id[:8] if obj.device_id else ""


class RevokeDeviceRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, min_length=2)


class AndroidConfigResponseSerializer(serializers.Serializer):
    minimum_version_code = serializers.IntegerField()
    latest_version_code = serializers.IntegerField()
    download_url = serializers.CharField(allow_blank=True)
    maintenance_message = serializers.CharField(allow_blank=True)
