from decimal import Decimal

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
        DHABA = "DHABA", "Dhaba / Highway Dining"
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
    food_gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5.00"),
    )
    hotel_gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("12.00"),
    )
    review_qr_url = models.URLField(max_length=500, blank=True, default="")
    review_qr_label = models.CharField(
        max_length=80,
        blank=True,
        default="Scan to leave us a review",
    )
    invoice_prefix = models.CharField(max_length=20, default="INV-")
    logo_url = models.CharField(max_length=500, blank=True, default="")
    logo_128_url = models.CharField(max_length=500, blank=True, default="")
    primary_color = models.CharField(max_length=16, default="#FF6A00")

    class Meta:
        verbose_name_plural = "Business settings"

    def __str__(self) -> str:
        return f"Settings ({self.tenant.name})"


class SupportTicket(TenantOwnedModel):
    """Customer support ticket for troubleshooting and feature inquiries (A-04, R-11)."""

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    admin_notes = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.status}] {self.subject} ({self.tenant.name})"


class PlatformAnnouncement(UUIDModel, TimeStampedModel):
    """Platform-wide announcement for maintenance notices, downtime and feature releases (A-05)."""

    class AnnouncementType(models.TextChoices):
        INFO = "INFO", "Information"
        MAINTENANCE = "MAINTENANCE", "Scheduled Maintenance"
        FEATURE = "FEATURE", "New Feature"
        WARNING = "WARNING", "Urgent Alert"

    title = models.CharField(max_length=255)
    message = models.TextField()
    announcement_type = models.CharField(
        max_length=20,
        choices=AnnouncementType.choices,
        default=AnnouncementType.INFO,
    )
    target_business_type = models.CharField(
        max_length=32,
        default="ALL",
        db_index=True,
        help_text="Target business type (ALL, RESTAURANT, CAFE, TEA_SHOP, BAKERY, HOTEL, FOOD_COURT)",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.announcement_type}] {self.title}"


class DemoLead(UUIDModel, TimeStampedModel):
    """Public demo-booking lead stored at platform level without tenant coupling."""

    class LeadStatus(models.TextChoices):
        NEW = "NEW", "New"
        CONTACTED = "CONTACTED", "Contacted"
        CLOSED = "CLOSED", "Closed"

    class BusinessType(models.TextChoices):
        TEA_SHOP = "TEA_SHOP", "Tea shop"
        BAKERY = "BAKERY", "Bakery"
        CAFE = "CAFE", "Cafe"
        RESTAURANT = "RESTAURANT", "Restaurant"
        FINE_DINING = "FINE_DINING", "Fine dining"
        HOTEL = "HOTEL", "Hotel restaurant"
        FOOD_COURT = "FOOD_COURT", "Food court"

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15, db_index=True)
    business_type = models.CharField(max_length=32, choices=BusinessType.choices)
    city = models.CharField(max_length=80)
    message = models.TextField(blank=True, default="")
    language = models.CharField(max_length=8, default="en")
    consent = models.BooleanField(default=False)
    status = models.CharField(
        max_length=16,
        choices=LeadStatus.choices,
        default=LeadStatus.NEW,
        db_index=True,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.business_type} ({self.city}) [{self.status}]"
