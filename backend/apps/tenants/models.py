from django.db import models

from apps.core.models import TenantOwnedModel, TimeStampedModel, UUIDModel


class Tenant(UUIDModel, TimeStampedModel):
    """Represents an independent restaurant organization/account."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"

    class BusinessType(models.TextChoices):
        TEA_SHOP = "TEA_SHOP", "Tea Shop"
        BAKERY = "BAKERY", "Bakery"
        CAFE = "CAFE", "Café"
        RESTAURANT = "RESTAURANT", "Restaurant"
        FINE_DINING = "FINE_DINING", "Fine Dining"
        HOTEL = "HOTEL", "Hotel"
        FOOD_COURT = "FOOD_COURT", "Food Court"
        CHAIN = "CHAIN", "Chain"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    business_type = models.CharField(
        max_length=32,
        choices=BusinessType.choices,
        default=BusinessType.RESTAURANT,
    )
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    currency = models.CharField(max_length=10, default="INR")

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"

    def get_branches_count(self) -> int:
        return Branch.unscoped.filter(tenant=self).count()

    def get_branches_list(self):
        return Branch.unscoped.filter(tenant=self)


class Branch(TenantOwnedModel):
    """Represents a physical or virtual restaurant outlet/location for a tenant."""

    class VenueProfile(models.TextChoices):
        QUICK_SERVICE = "QUICK_SERVICE", "Quick Service"
        CAFE = "CAFE", "Café"
        CASUAL_DINING = "CASUAL_DINING", "Casual Dining"
        FINE_DINING = "FINE_DINING", "Fine Dining"
        HOTEL_RESTAURANT = "HOTEL_RESTAURANT", "Hotel Restaurant"
        FOOD_COURT = "FOOD_COURT", "Food Court"
        BAR_BREWERY = "BAR_BREWERY", "Bar / Brewery"

    name = models.CharField(max_length=255)
    venue_profile = models.CharField(
        max_length=32,
        choices=VenueProfile.choices,
        default=VenueProfile.CASUAL_DINING,
    )
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)
    operating_hours = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_tenant_branch_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} - {self.tenant.name}"


class BusinessSettings(TenantOwnedModel):
    """Tenant-level branding, tax, and invoicing configuration."""

    class TaxMode(models.TextChoices):
        INCLUSIVE = "INCLUSIVE", "Tax Inclusive"
        EXCLUSIVE = "EXCLUSIVE", "Tax Exclusive"

    class DocumentLanguage(models.TextChoices):
        EN = "EN", "English"
        EN_TA = "EN_TA", "English and Tamil"

    # BusinessSettings is 1-to-1 with Tenant
    tenant = models.OneToOneField(
        Tenant,
        on_delete=models.CASCADE,
        related_name="business_settings",
        db_index=True,
    )
    legal_name = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=15, blank=True, default="")
    registered_address = models.TextField(blank=True, default="")
    document_language = models.CharField(
        max_length=10,
        choices=DocumentLanguage.choices,
        default=DocumentLanguage.EN,
    )
    brand_primary_color = models.CharField(max_length=7, default="#FF6A00")
    receipt_footer_text = models.CharField(max_length=200, blank=True, default="")

    tax_mode = models.CharField(
        max_length=20,
        choices=TaxMode.choices,
        default=TaxMode.INCLUSIVE,
    )
    invoice_prefix = models.CharField(max_length=20, default="INV-")
    logo_url = models.CharField(max_length=500, blank=True, default="")
    logo_128_url = models.CharField(max_length=500, blank=True, default="")
    primary_color = models.CharField(max_length=16, default="#FF6A00")

    class Meta:
        verbose_name_plural = "Business settings"

    def __str__(self) -> str:
        return f"Settings ({self.tenant.name})"
