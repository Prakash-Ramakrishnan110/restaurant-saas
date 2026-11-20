from django.db import models


class InventoryItemType(models.TextChoices):
    INGREDIENT = "INGREDIENT", "Ingredient"
    PREPARED = "PREPARED", "Prepared"
    FINISHED = "FINISHED", "Finished"
    PACKAGING = "PACKAGING", "Packaging"
    SUPPLY = "SUPPLY", "Supply"


class BaseUnit(models.TextChoices):
    GRAM = "g", "Grams (g)"
    MILLILITER = "ml", "Milliliters (ml)"
    PIECE = "piece", "Piece"


class InventoryCategory(models.TextChoices):
    PRODUCE = "PRODUCE", "Produce & Vegetables"
    DAIRY = "DAIRY", "Dairy & Milk"
    MEAT_POULTRY = "MEAT_POULTRY", "Meat & Poultry"
    SPICES_MASALA = "SPICES_MASALA", "Spices & Masala"
    GRAINS_FLOUR = "GRAINS_FLOUR", "Grains, Rice & Flour"
    OIL_GHEE = "OIL_GHEE", "Oil & Ghee"
    BEVERAGES = "BEVERAGES", "Tea, Coffee & Beverages"
    BAKERY = "BAKERY", "Bakery & Sweets"
    PREPARED = "PREPARED", "Prepared Bases"
    PACKAGING = "PACKAGING", "Packaging & Cups"
    CLEANING = "CLEANING", "Cleaning & Supplies"
    OTHER = "OTHER", "Other"


class StockLocationType(models.TextChoices):
    STORE = "STORE", "Store"
    KITCHEN = "KITCHEN", "Kitchen"
    BAR = "BAR", "Bar"
    COUNTER = "COUNTER", "Counter"


class StockMovementType(models.TextChoices):
    OPENING = "OPENING", "Opening Balance"
    PURCHASE = "PURCHASE", "Purchase Receipt"
    SALE_USAGE = "SALE_USAGE", "Sale Usage"
    PRODUCTION_IN = "PRODUCTION_IN", "Production In"
    PRODUCTION_USAGE = "PRODUCTION_USAGE", "Production Usage"
    WASTE = "WASTE", "Waste"
    ADJUSTMENT = "ADJUSTMENT", "Manual Adjustment"
    COUNT_VARIANCE = "COUNT_VARIANCE", "Count Variance"
    TRANSFER_OUT = "TRANSFER_OUT", "Transfer Out"
    TRANSFER_IN = "TRANSFER_IN", "Transfer In"
    SUPPLIER_RETURN = "SUPPLIER_RETURN", "Supplier Return"
    PACKAGING_USAGE = "PACKAGING_USAGE", "Packaging Usage"


class WasteReason(models.TextChoices):
    SPOILED = "SPOILED", "Spoiled"
    EXPIRED = "EXPIRED", "Expired"
    DROPPED = "DROPPED", "Dropped"
    COOKING_ERROR = "COOKING_ERROR", "Cooking Error"
    STAFF_MEAL = "STAFF_MEAL", "Staff Meal"
    COMPLIMENTARY = "COMPLIMENTARY", "Complimentary"
    RETURNED_BY_GUEST = "RETURNED_BY_GUEST", "Returned by Guest"
    UNSOLD = "UNSOLD", "Unsold"
    CANCELLED_AFTER_COOKING = "CANCELLED_AFTER_COOKING", "Cancelled After Cooking"
    OTHER = "OTHER", "Other"


class PurchaseOrderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SENT = "SENT", "Sent"
    PARTIAL = "PARTIAL", "Partially Received"
    RECEIVED = "RECEIVED", "Received"
    CANCELLED = "CANCELLED", "Cancelled"


class StockCountType(models.TextChoices):
    FULL = "FULL", "Full Count"
    CATEGORY = "CATEGORY", "By Category"


class StockCountStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"


class StockTransferStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class DeductionStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"
    CANCELLED_WASTED = "CANCELLED_WASTED", "Cancelled After Cooking"


class InventoryMode(models.TextChoices):
    SIMPLE = "SIMPLE", "Simple"
    STANDARD = "STANDARD", "Standard"
    ADVANCED = "ADVANCED", "Advanced"


class PackagingMode(models.TextChoices):
    NONE = "NONE", "Not Auto-Deducted"
    PER_ORDER = "PER_ORDER", "Per Takeaway Order"
    PER_ITEM = "PER_ITEM", "Per Takeaway Item"


BUSINESS_TYPE_DEFAULT_MODE: dict[str, str] = {
    "TEA_SHOP": InventoryMode.SIMPLE,
    "FOOD_COURT": InventoryMode.SIMPLE,
    "BAKERY": InventoryMode.STANDARD,
    "CAFE": InventoryMode.STANDARD,
    "RESTAURANT": InventoryMode.STANDARD,
    "FINE_DINING": InventoryMode.STANDARD,
    "DHABA": InventoryMode.STANDARD,
    "CLOUD_KITCHEN": InventoryMode.STANDARD,
    "HOTEL": InventoryMode.ADVANCED,
}
