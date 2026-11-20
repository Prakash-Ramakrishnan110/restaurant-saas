from __future__ import annotations

from decimal import Decimal

from apps.core.context import set_current_tenant
from apps.inventory.constants import (
    BaseUnit,
    InventoryCategory,
    InventoryItemType,
    InventoryMode,
    PackagingMode,
    StockLocationType,
    StockMovementType,
)
from apps.inventory.models import (
    InventoryItem,
    InventorySettings,
    Recipe,
    RecipeLine,
    StockLocation,
    StockMovement,
    Supplier,
    UnitConversion,
)
from apps.inventory.services import (
    get_or_create_default_location,
    post_stock_movement,
)
from apps.menu.models import MenuItem
from apps.tenants.models import Branch, Tenant


def _ensure_item_with_opening(
    *,
    tenant: Tenant,
    branch: Branch,
    location: StockLocation,
    name: str,
    name_ta: str,
    item_type: str,
    base_unit: str,
    category: str,
    opening_qty: Decimal,
    unit_cost_paise: int,
    reorder_level: Decimal,
    par_level: Decimal,
    supplier: Supplier | None = None,
    packaging_mode: str = PackagingMode.NONE,
    packaging_quantity: Decimal = Decimal("1.000"),
    conversions: list[tuple[str, Decimal]] | None = None,
) -> InventoryItem:
    item, _ = InventoryItem.unscoped.get_or_create(
        tenant=tenant,
        name=name,
        defaults={
            "name_ta": name_ta,
            "item_type": item_type,
            "base_unit": base_unit,
            "category": category,
            "reorder_level": reorder_level,
            "par_level": par_level,
            "default_supplier": supplier,
            "packaging_mode": packaging_mode,
            "packaging_quantity": packaging_quantity,
        },
    )
    if conversions:
        for unit_name, factor in conversions:
            UnitConversion.unscoped.get_or_create(
                tenant=tenant,
                item=item,
                unit_name=unit_name,
                defaults={"factor_to_base": factor},
            )
    if (
        opening_qty > Decimal("0")
        and not StockMovement.unscoped.filter(branch=branch, location=location, item=item).exists()
    ):
        post_stock_movement(
            branch=branch,
            location=location,
            item=item,
            movement_type=StockMovementType.OPENING,
            quantity=opening_qty,
            unit_cost_paise=unit_cost_paise,
            reference_type="SeedOpening",
            reference_id=str(item.id),
            reason_code="OPENING",
            notes="Initial seeded stock",
        )
    return item


def seed_inventory_for_all_venues() -> None:
    """Idempotently seed fictional inventory items, locations, and recipes across demo venues."""
    venues: list[tuple[str, str]] = [
        ("Chai Corner", InventoryMode.SIMPLE),
        ("Artisan Bakehouse", InventoryMode.STANDARD),
        ("Bean & Bloom Cafe", InventoryMode.STANDARD),
        ("Spice Garden", InventoryMode.STANDARD),
        ("Grand Meridian", InventoryMode.ADVANCED),
    ]

    for tenant_name, mode in venues:
        tenant = Tenant.objects.filter(name=tenant_name).first()
        if tenant is None:
            continue
        branch = (
            Branch.unscoped.filter(tenant=tenant, is_active=True).order_by("created_at").first()
        )
        if branch is None:
            continue

        set_current_tenant(tenant)
        InventorySettings.unscoped.update_or_create(
            branch=branch,
            defaults={"tenant": tenant, "mode": mode},
        )
        default_loc = get_or_create_default_location(branch)

        supplier, _ = Supplier.unscoped.get_or_create(
            tenant=tenant,
            name=f"{tenant_name} Fresh Distributors",
            defaults={
                "contact_person": "Suresh Mani",
                "phone": "+91 98400 11223",
                "email": f"supply@{tenant.slug}.example.com",
            },
        )

        if tenant_name == "Chai Corner":
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Assam Tea Dust",
                name_ta="தேயிலை தூள்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.BEVERAGES,
                opening_qty=Decimal("5000.000"),
                unit_cost_paise=45,
                reorder_level=Decimal("1000.000"),
                par_level=Decimal("6000.000"),
                supplier=supplier,
                conversions=[("kg", Decimal("1000"))],
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Farm Fresh Milk",
                name_ta="பசும்பால்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.MILLILITER,
                category=InventoryCategory.DAIRY,
                opening_qty=Decimal("20000.000"),
                unit_cost_paise=6,
                reorder_level=Decimal("5000.000"),
                par_level=Decimal("25000.000"),
                supplier=supplier,
                conversions=[("L", Decimal("1000"))],
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Cane Sugar",
                name_ta="சர்க்கரை",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.OTHER,
                opening_qty=Decimal("8000.000"),
                unit_cost_paise=5,
                reorder_level=Decimal("2000.000"),
                par_level=Decimal("10000.000"),
                supplier=supplier,
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Paper Chai Cups",
                name_ta="காகித கோப்பை",
                item_type=InventoryItemType.PACKAGING,
                base_unit=BaseUnit.PIECE,
                category=InventoryCategory.PACKAGING,
                opening_qty=Decimal("500.000"),
                unit_cost_paise=120,
                reorder_level=Decimal("100.000"),
                par_level=Decimal("600.000"),
                supplier=supplier,
                packaging_mode=PackagingMode.PER_ITEM,
                packaging_quantity=Decimal("1.000"),
            )

        elif tenant_name == "Artisan Bakehouse":
            for nm, ta, typ, unit, cat, qty, cost, reord, par, pmode in [
                (
                    "Refined Baking Flour",
                    "மைதா மாவு",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.GRAM,
                    InventoryCategory.GRAINS_FLOUR,
                    Decimal("15000.000"),
                    6,
                    Decimal("3000.000"),
                    Decimal("20000.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Cultured Butter",
                    "வெண்ணெய்",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.GRAM,
                    InventoryCategory.DAIRY,
                    Decimal("4000.000"),
                    65,
                    Decimal("1000.000"),
                    Decimal("5000.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Dry Baker Yeast",
                    "ஈஸ்ட்",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.GRAM,
                    InventoryCategory.BAKERY,
                    Decimal("500.000"),
                    80,
                    Decimal("100.000"),
                    Decimal("600.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Caster Sugar",
                    "சர்க்கரை",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.GRAM,
                    InventoryCategory.BAKERY,
                    Decimal("6000.000"),
                    7,
                    Decimal("1500.000"),
                    Decimal("8000.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Baked Brioche Buns",
                    "பிரையோச் பன்",
                    InventoryItemType.FINISHED,
                    BaseUnit.PIECE,
                    InventoryCategory.BAKERY,
                    Decimal("60.000"),
                    1800,
                    Decimal("15.000"),
                    Decimal("80.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Kraft Pastry Boxes",
                    "பேஸ்ட்ரி பெட்டி",
                    InventoryItemType.PACKAGING,
                    BaseUnit.PIECE,
                    InventoryCategory.PACKAGING,
                    Decimal("200.000"),
                    650,
                    Decimal("50.000"),
                    Decimal("300.000"),
                    PackagingMode.PER_ORDER,
                ),
            ]:
                _ensure_item_with_opening(
                    tenant=tenant,
                    branch=branch,
                    location=default_loc,
                    name=nm,
                    name_ta=ta,
                    item_type=typ,
                    base_unit=unit,
                    category=cat,
                    opening_qty=qty,
                    unit_cost_paise=cost,
                    reorder_level=reord,
                    par_level=par,
                    supplier=supplier,
                    packaging_mode=pmode,
                )

        elif tenant_name == "Bean & Bloom Cafe":
            for nm, ta, typ, unit, cat, qty, cost, reord, par, pmode in [
                (
                    "Roasted Coffee Beans",
                    "வறுத்த காபி கொட்டை",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.GRAM,
                    InventoryCategory.BEVERAGES,
                    Decimal("4000.000"),
                    95,
                    Decimal("800.000"),
                    Decimal("5000.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Whole Barista Milk",
                    "பால்",
                    InventoryItemType.INGREDIENT,
                    BaseUnit.MILLILITER,
                    InventoryCategory.DAIRY,
                    Decimal("18000.000"),
                    7,
                    Decimal("4000.000"),
                    Decimal("24000.000"),
                    PackagingMode.NONE,
                ),
                (
                    "Takeaway Coffee Cups",
                    "காபி கோப்பை",
                    InventoryItemType.PACKAGING,
                    BaseUnit.PIECE,
                    InventoryCategory.PACKAGING,
                    Decimal("300.000"),
                    350,
                    Decimal("75.000"),
                    Decimal("400.000"),
                    PackagingMode.PER_ITEM,
                ),
            ]:
                _ensure_item_with_opening(
                    tenant=tenant,
                    branch=branch,
                    location=default_loc,
                    name=nm,
                    name_ta=ta,
                    item_type=typ,
                    base_unit=unit,
                    category=cat,
                    opening_qty=qty,
                    unit_cost_paise=cost,
                    reorder_level=reord,
                    par_level=par,
                    supplier=supplier,
                    packaging_mode=pmode,
                )

        elif tenant_name == "Spice Garden":
            paneer = _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Fresh Malai Paneer",
                name_ta="பனீர்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.DAIRY,
                opening_qty=Decimal("5000.000"),
                unit_cost_paise=42,
                reorder_level=Decimal("1000.000"),
                par_level=Decimal("6000.000"),
                supplier=supplier,
            )
            chicken = _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Boneless Chicken Breast",
                name_ta="எலும்பில்லாத கோழி",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.MEAT_POULTRY,
                opening_qty=Decimal("8000.000"),
                unit_cost_paise=38,
                reorder_level=Decimal("1500.000"),
                par_level=Decimal("10000.000"),
                supplier=supplier,
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Aged Basmati Rice",
                name_ta="பாஸ்மதி அரிசி",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.GRAINS_FLOUR,
                opening_qty=Decimal("20000.000"),
                unit_cost_paise=16,
                reorder_level=Decimal("5000.000"),
                par_level=Decimal("25000.000"),
                supplier=supplier,
            )
            oil = _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Refined Sunflower Oil",
                name_ta="சமையல் எண்ணெய்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.MILLILITER,
                category=InventoryCategory.OIL_GHEE,
                opening_qty=Decimal("15000.000"),
                unit_cost_paise=15,
                reorder_level=Decimal("3000.000"),
                par_level=Decimal("20000.000"),
                supplier=supplier,
            )
            spices = _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="House Garam Masala",
                name_ta="கரம் மசாலா",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.SPICES_MASALA,
                opening_qty=Decimal("2000.000"),
                unit_cost_paise=60,
                reorder_level=Decimal("500.000"),
                par_level=Decimal("2500.000"),
                supplier=supplier,
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Tandoor Naan Flour",
                name_ta="நான் மாவு",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.GRAINS_FLOUR,
                opening_qty=Decimal("12000.000"),
                unit_cost_paise=6,
                reorder_level=Decimal("3000.000"),
                par_level=Decimal("15000.000"),
                supplier=supplier,
            )
            gravy_base = _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Makhani Gravy Base",
                name_ta="மக்கானி கிரேவி",
                item_type=InventoryItemType.PREPARED,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.PREPARED,
                opening_qty=Decimal("4000.000"),
                unit_cost_paise=28,
                reorder_level=Decimal("1000.000"),
                par_level=Decimal("5000.000"),
                supplier=supplier,
            )

            # Prepared sub-recipe for Makhani Gravy Base
            gb_recipe, created = Recipe.unscoped.get_or_create(
                tenant=tenant,
                output_item=gravy_base,
                defaults={"yield_portions": Decimal("1000.000")},
            )
            if created:
                RecipeLine.unscoped.create(
                    tenant=tenant,
                    recipe=gb_recipe,
                    item=oil,
                    quantity_per_portion=Decimal("100.000"),
                    waste_percent=Decimal("2.00"),
                )
                RecipeLine.unscoped.create(
                    tenant=tenant,
                    recipe=gb_recipe,
                    item=spices,
                    quantity_per_portion=Decimal("50.000"),
                    waste_percent=Decimal("0.00"),
                )

            # Dish recipes for Spice Garden
            butter_chicken = MenuItem.objects.filter(
                tenant=tenant, name="Butter Chicken Royal"
            ).first()
            if butter_chicken:
                rec, created = Recipe.unscoped.get_or_create(
                    tenant=tenant,
                    menu_item=butter_chicken,
                    variant=None,
                    defaults={"yield_portions": Decimal("1.000")},
                )
                if created:
                    RecipeLine.unscoped.create(
                        tenant=tenant,
                        recipe=rec,
                        item=chicken,
                        quantity_per_portion=Decimal("200.000"),
                        waste_percent=Decimal("5.00"),
                    )
                    RecipeLine.unscoped.create(
                        tenant=tenant,
                        recipe=rec,
                        item=gravy_base,
                        quantity_per_portion=Decimal("150.000"),
                        waste_percent=Decimal("0.00"),
                    )

            paneer_tikka = MenuItem.objects.filter(
                tenant=tenant, name="Paneer Tikka Angare"
            ).first()
            if paneer_tikka:
                rec, created = Recipe.unscoped.get_or_create(
                    tenant=tenant,
                    menu_item=paneer_tikka,
                    variant=None,
                    defaults={"yield_portions": Decimal("1.000")},
                )
                if created:
                    RecipeLine.unscoped.create(
                        tenant=tenant,
                        recipe=rec,
                        item=paneer,
                        quantity_per_portion=Decimal("180.000"),
                        waste_percent=Decimal("5.00"),
                    )
                    RecipeLine.unscoped.create(
                        tenant=tenant,
                        recipe=rec,
                        item=spices,
                        quantity_per_portion=Decimal("15.000"),
                        waste_percent=Decimal("0.00"),
                    )

        elif tenant_name == "Grand Meridian":
            kitchen_loc, _ = StockLocation.unscoped.get_or_create(
                tenant=tenant,
                branch=branch,
                name="Main Kitchen",
                defaults={"location_type": StockLocationType.KITCHEN, "is_default": False},
            )
            bar_loc, _ = StockLocation.unscoped.get_or_create(
                tenant=tenant,
                branch=branch,
                name="Lounge Bar",
                defaults={"location_type": StockLocationType.BAR, "is_default": False},
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=default_loc,
                name="Central Store Basmati Rice",
                name_ta="பாஸ்மதி அரிசி",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.GRAM,
                category=InventoryCategory.GRAINS_FLOUR,
                opening_qty=Decimal("50000.000"),
                unit_cost_paise=18,
                reorder_level=Decimal("10000.000"),
                par_level=Decimal("60000.000"),
                supplier=supplier,
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=kitchen_loc,
                name="Kitchen Cooking Cream",
                name_ta="சமையல் கிரீம்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.MILLILITER,
                category=InventoryCategory.DAIRY,
                opening_qty=Decimal("8000.000"),
                unit_cost_paise=24,
                reorder_level=Decimal("2000.000"),
                par_level=Decimal("10000.000"),
                supplier=supplier,
            )
            _ensure_item_with_opening(
                tenant=tenant,
                branch=branch,
                location=bar_loc,
                name="Artisan Ginger Ale Syrup",
                name_ta="இஞ்சி சிரப்",
                item_type=InventoryItemType.INGREDIENT,
                base_unit=BaseUnit.MILLILITER,
                category=InventoryCategory.BEVERAGES,
                opening_qty=Decimal("5000.000"),
                unit_cost_paise=35,
                reorder_level=Decimal("1000.000"),
                par_level=Decimal("6000.000"),
                supplier=supplier,
            )

    set_current_tenant(None)
