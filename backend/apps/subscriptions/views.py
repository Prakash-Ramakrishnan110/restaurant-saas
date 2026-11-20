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

    @extend_schema(
        summary="Create subscription plan",
        description="Platform admin only: create a new subscription plan with pricing and entitlements.",
    )
    def post(self, request: Request) -> Response:
        if not getattr(request.user, "is_platform_admin", False):
            return Response(
                {
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Only platform administrators can create plans.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        name = str(request.data.get("name", "")).strip()
        slug = str(request.data.get("slug", "")).strip()
        price_paise = request.data.get("price_paise", 0)
        entitlements = request.data.get("entitlements", {})
        is_active = request.data.get("is_active", True)

        if not name:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "Plan name is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils.text import slugify

        if not slug:
            slug = slugify(name)

        if Plan.objects.filter(slug=slug).exists():
            return Response(
                {
                    "error": {
                        "code": "DUPLICATE_SLUG",
                        "message": f"A plan with slug '{slug}' already exists.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = Plan.objects.create(
            name=name,
            slug=slug,
            price_paise=int(price_paise),
            entitlements=entitlements,
            is_active=bool(is_active),
        )

        return Response(
            {
                "id": str(plan.id),
                "name": plan.name,
                "slug": plan.slug,
                "price_paise": plan.price_paise,
                "entitlements": plan.entitlements,
                "is_active": plan.is_active,
            },
            status=status.HTTP_201_CREATED,
        )


class PlanDetailView(APIView):
    """View, update or toggle individual subscription plans."""

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, pk: str) -> Response:
        if not getattr(request.user, "is_platform_admin", False):
            return Response(
                {
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Only platform administrators can update plans.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            plan = Plan.objects.get(id=pk)
        except Plan.DoesNotExist:
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Plan not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if "name" in request.data:
            plan.name = str(request.data["name"]).strip()
        if "price_paise" in request.data:
            plan.price_paise = int(request.data["price_paise"])
        if "entitlements" in request.data:
            plan.entitlements = request.data["entitlements"]
        if "is_active" in request.data:
            plan.is_active = bool(request.data["is_active"])

        plan.save()

        return Response(
            {
                "id": str(plan.id),
                "name": plan.name,
                "slug": plan.slug,
                "price_paise": plan.price_paise,
                "entitlements": plan.entitlements,
                "is_active": plan.is_active,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request: Request, pk: str) -> Response:
        if not getattr(request.user, "is_platform_admin", False):
            return Response(
                {
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Only platform administrators can delete plans.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            plan = Plan.objects.get(id=pk)
        except Plan.DoesNotExist:
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Plan not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.subscriptions.models import Subscription

        assigned_count = Subscription.objects.filter(plan=plan).count()
        if assigned_count > 0:
            return Response(
                {
                    "error": {
                        "code": "PLAN_IN_USE",
                        "message": (
                            f"Cannot delete '{plan.name}' because {assigned_count} customer(s) "
                            "are currently assigned to it. Move them to another plan first."
                        ),
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
