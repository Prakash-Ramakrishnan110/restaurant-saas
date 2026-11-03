from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.context import get_current_tenant
from apps.rbac.permissions import BaseTenantPermission
from apps.subscriptions.services import get_tenant_entitlements_summary


class EntitlementsView(APIView):
    """View current subscription plan, operational limits, feature flags, and active usage."""

    permission_classes = [BaseTenantPermission]

    @extend_schema(
        summary="Get tenant subscription entitlements and usage",
        description="Returns plan name, subscription status, numeric limits with remaining headroom, and feature flags.",
    )
    def get(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Active tenant context required.",
                        "details": {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = get_tenant_entitlements_summary(tenant)
        return Response(summary, status=status.HTTP_200_OK)
