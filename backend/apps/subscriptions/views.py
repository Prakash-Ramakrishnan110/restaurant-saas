from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.context import get_current_tenant
from apps.rbac.permissions import BaseTenantPermission
from apps.subscriptions.models import Plan
from apps.subscriptions.services import get_tenant_entitlements_summary


class PlanListView(APIView):
    """View all active subscription plans, pricing, and limits."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        summary="List all subscription plans",
        description="Returns list of available SaaS plans, pricing in paise, and entitlement limits.",
    )
    def get(self, request: Request) -> Response:
        plans = Plan.objects.filter(is_active=True).order_by("price_paise")
        data = [
            {
                "id": str(p.id),
                "name": p.name,
                "slug": p.slug,
                "price_paise": p.price_paise,
                "entitlements": p.entitlements,
                "is_active": p.is_active,
            }
            for p in plans
        ]
        return Response(data, status=status.HTTP_200_OK)


class EntitlementsView(APIView):
    """View current subscription plan, operational limits, feature flags, and active usage."""

    permission_classes = [BaseTenantPermission]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
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
