from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel, UUIDModel
from apps.subscriptions.constants import SubscriptionStatus


class Plan(UUIDModel, TimeStampedModel):
    """SaaS subscription plan definition."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    price_paise = models.BigIntegerField(
        default=0,
        help_text="Recurring price in integer paise (e.g. 299900 = ₹2,999.00)",
    )
    entitlements = models.JSONField(
        default=dict,
        blank=True,
        help_text="Plan feature flags and operational limits (e.g. max_tables, max_service_areas)",
    )
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"


class Subscription(UUIDModel, TimeStampedModel):
    """Tenant subscription lifecycle tracking."""

    tenant = models.OneToOneField(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscriptions",
    )
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL,
        db_index=True,
    )
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.tenant.name} -> {self.status}"
