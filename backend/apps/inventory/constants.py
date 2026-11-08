from django.db import models


class UnitOfMeasure(models.TextChoices):
    KG = "KG", "Kilogram (kg)"
    GRAM = "GRAM", "Gram (g)"
    LITER = "LITER", "Liter (L)"
    ML = "ML", "Milliliter (mL)"
    PIECE = "PIECE", "Piece (pc)"
    PACKET = "PACKET", "Packet (pkt)"


class IngredientCategory(models.TextChoices):
    DRY_GOODS = "DRY_GOODS", "Dry Goods & Grains"
    DAIRY = "DAIRY", "Dairy & Eggs"
    MEAT = "MEAT", "Meat & Seafood"
    VEGETABLE = "VEGETABLE", "Vegetables & Produce"
    BEVERAGE = "BEVERAGE", "Beverages & Liquids"
    SPICE_CONDIMENT = "SPICE_CONDIMENT", "Spices & Condiments"
    PACKAGING = "PACKAGING", "Packaging & Disposables"
    OTHER = "OTHER", "Other"


class PurchaseOrderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    RECEIVED = "RECEIVED", "Received & Stocked"
    CANCELLED = "CANCELLED", "Cancelled"


class WastageReason(models.TextChoices):
    EXPIRED = "EXPIRED", "Expired / Date Passed"
    SPOILED = "SPOILED", "Spoiled / Quality Degraded"
    BURNT_PREP = "BURNT_PREP", "Burnt / Prep Error"
    SPILLAGE = "SPILLAGE", "Spillage / Handling Drop"
    OTHER = "OTHER", "Other"


class StockTransactionType(models.TextChoices):
    INWARD_PURCHASE = "INWARD_PURCHASE", "Inward Purchase"
    OUTWARD_SALE = "OUTWARD_SALE", "Outward Recipe Depletion"
    WASTAGE = "WASTAGE", "Wastage / Spoilage Write-Off"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT", "Manual Stock Reconciliation"
