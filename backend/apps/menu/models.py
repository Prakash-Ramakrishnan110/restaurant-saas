import uuid

from django.conf import settings
from django.db import models

from apps.menu.constants import FoodType


class MenuCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="menu_categories",
    )
    name = models.CharField(max_length=100)
    name_ta = models.CharField(max_length=100, blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_categories"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_tenant_category_name",
            )
        ]

    def __str__(self) -> str:
        return self.name


class MenuItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="menu_items",
    )
    category = models.ForeignKey(
        MenuCategory,
        on_delete=models.PROTECT,
        related_name="items",
    )
    name = models.CharField(max_length=150)
    name_ta = models.CharField(max_length=150, blank=True, default="")
    description = models.TextField(blank=True, default="")
    description_ta = models.TextField(blank=True, default="")
    base_price_paise = models.PositiveIntegerField(default=0)
    food_type = models.CharField(
        max_length=20,
        choices=FoodType.choices,
        default=FoodType.VEG,
    )
    prep_minutes = models.PositiveIntegerField(null=True, blank=True)
    is_bestseller = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    # Image pipeline fields
    image_original = models.CharField(max_length=500, blank=True, default="")
    image_card = models.CharField(max_length=500, blank=True, default="")
    image_thumb = models.CharField(max_length=500, blank=True, default="")
    image_bytes = models.PositiveIntegerField(default=0)
    image_focus_x = models.FloatField(default=0.5)
    image_focus_y = models.FloatField(default=0.5)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_items"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "category", "name"],
                name="unique_tenant_category_item_name",
            )
        ]

    def __str__(self) -> str:
        return self.name


class ItemVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    name = models.CharField(max_length=100)
    name_ta = models.CharField(max_length=100, blank=True, default="")
    price_paise = models.PositiveIntegerField()
    is_default = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_item_variants"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["item"],
                condition=models.Q(is_default=True),
                name="unique_default_variant_per_item",
            )
        ]

    def __str__(self) -> str:
        return f"{self.item.name} - {self.name}"


class OptionGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="menu_option_groups",
    )
    name = models.CharField(max_length=100)
    name_ta = models.CharField(max_length=100, blank=True, default="")
    min_select = models.PositiveIntegerField(default=0)
    max_select = models.PositiveIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_option_groups"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Option(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        OptionGroup,
        on_delete=models.CASCADE,
        related_name="options",
    )
    name = models.CharField(max_length=100)
    name_ta = models.CharField(max_length=100, blank=True, default="")
    price_delta_paise = models.IntegerField(default=0)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "menu_options"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return f"{self.group.name} - {self.name}"


class ItemOptionGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="item_option_groups",
    )
    group = models.ForeignKey(
        OptionGroup,
        on_delete=models.CASCADE,
        related_name="group_item_links",
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "menu_item_option_groups"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["item", "group"],
                name="unique_item_option_group",
            )
        ]


class BranchItemAvailability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="branch_item_availabilities",
    )
    branch = models.ForeignKey(
        "tenants.Branch",
        on_delete=models.CASCADE,
        related_name="item_availabilities",
    )
    item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="branch_availabilities",
    )
    is_available = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_branch_item_availability"
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "item"],
                name="unique_branch_item_availability",
            )
        ]

    def __str__(self) -> str:
        return f"{self.branch.name} - {self.item.name} ({'Available' if self.is_available else 'Sold Out'})"
