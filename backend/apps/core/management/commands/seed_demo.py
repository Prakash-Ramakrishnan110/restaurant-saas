from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Membership
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderStatus,
    OrderWorkflow,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import AreaType, SectionType, TableStatus
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession

User = get_user_model()


class Command(BaseCommand):
    help = "Idempotently seeds rich demonstration data for Cafe & Quick-Service Tea Shop tenants."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding ServeMyFood demonstration data..."))

        with transaction.atomic():
            # 1. Base Subscription Plans
            plan_pro, _ = Plan.objects.get_or_create(
                slug="pro",
                defaults={
                    "name": "Pro Tier",
                    "entitlements": {"max_tables": 100, "max_branches": 5, "reports": True},
                },
            )

            # 2. TENANT 1: The Grand Kaveri Cafe (Full Dine-In & Multi-Role)
            self._seed_kaveri_cafe(plan_pro)

            # 3. TENANT 2: Madras Chai Point (Quick-Service Counter & Tokens)
            self._seed_madras_chai(plan_pro)

        self.stdout.write(self.style.SUCCESS("Demo seeding completed successfully!"))

    def _seed_kaveri_cafe(self, plan: Plan):
        self.stdout.write("Configuring 'The Grand Kaveri Cafe'...")
        t, _ = Tenant.objects.get_or_create(
            slug="kaveri-cafe",
            defaults={"name": "The Grand Kaveri Cafe", "status": Tenant.Status.ACTIVE},
        )
        set_current_tenant(t)

        BusinessSettings.objects.get_or_create(
            tenant=t,
            defaults={
                "tax_mode": BusinessSettings.TaxMode.INCLUSIVE,
                "invoice_prefix": "GKC-",
                "legal_name": "The Grand Kaveri Cafe Pvt Ltd",
                "gstin": "33AAAAA0000A1Z5",
                "registered_address": "42 South Usman Road, T. Nagar, Chennai - 600017",
                "brand_primary_color": "#FF6A00",
                "receipt_footer_text": "Thank you for dining at Kaveri Cafe! Visit us again.",
            },
        )

        Subscription.objects.get_or_create(
            tenant=t,
            defaults={"plan": plan, "status": SubscriptionStatus.ACTIVE},
        )

        b, _ = Branch.objects.get_or_create(
            tenant=t,
            name="T. Nagar Flagship",
            defaults={"is_active": True},
        )

        # Areas & Tables
        sa_hall, _ = ServiceArea.objects.get_or_create(
            tenant=t, branch=b, name="AC Dining Hall", defaults={"area_type": AreaType.DINING}
        )
        sec_indoor, _ = Section.objects.get_or_create(
            tenant=t,
            branch=b,
            service_area=sa_hall,
            name="Ground Indoor",
            defaults={"section_type": SectionType.INDOOR},
        )

        sa_terrace, _ = ServiceArea.objects.get_or_create(
            tenant=t, branch=b, name="Open Terrace", defaults={"area_type": AreaType.OUTDOOR}
        )
        sec_outdoor, _ = Section.objects.get_or_create(
            tenant=t,
            branch=b,
            service_area=sa_terrace,
            name="Rooftop Lawn",
            defaults={"section_type": SectionType.OUTDOOR},
        )

        tables = []
        for i in range(1, 9):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t,
                branch=b,
                section=sec_indoor,
                label=f"T{i}",
                defaults={"capacity": 4 if i <= 6 else 6, "status": TableStatus.AVAILABLE},
            )
            tables.append(tbl)

        for i in range(9, 13):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t,
                branch=b,
                section=sec_outdoor,
                label=f"T{i}",
                defaults={"capacity": 4, "status": TableStatus.AVAILABLE},
            )
            tables.append(tbl)

        # Staff Users (Dev password Password123!)
        staff_defs = [
            ("owner@kavericafe.com", "Ramanathan Iyer", Role.OWNER),
            ("manager@kavericafe.com", "Kavitha Sundaram", Role.BRANCH_MANAGER),
            ("cashier@kavericafe.com", "Karthik Subramanian", Role.CASHIER),
            ("waiter@kavericafe.com", "Muthu Vel", Role.WAITER),
            ("kitchen@kavericafe.com", "Chef Arumugam", Role.KITCHEN),
        ]

        users_map = {}
        for email, full_name, role in staff_defs:
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(
                    email=email, password="Password123!", full_name=full_name
                )
            else:
                user.set_password("Password123!")
                user.full_name = full_name
                user.save()

            m, _ = Membership.objects.get_or_create(
                user=user, tenant=t, defaults={"role": role, "is_active": True}
            )
            users_map[role] = (user, m)

        # 30 Menu Items across 4 Categories
        menu_catalog = [
            (
                "Hot Beverages",
                [
                    ("South Indian Filter Coffee", 4500, FoodType.VEG),
                    ("Masala Chai", 3500, FoodType.VEG),
                    ("Ginger Cardamom Tea", 3500, FoodType.VEG),
                    ("Sukku Coffee (Herbal)", 5000, FoodType.VEG),
                    ("Badam Milk (Hot)", 6500, FoodType.VEG),
                    ("Artisan Cappuccino", 9500, FoodType.VEG),
                    ("Cold Brew Nitro", 12000, FoodType.VEG),
                ],
            ),
            (
                "Tiffins & Starters",
                [
                    ("Ghee Podi Idli (2 pcs)", 9500, FoodType.VEG),
                    ("Crispy Medu Vada (2 pcs)", 7500, FoodType.VEG),
                    ("Plain Dosa", 8500, FoodType.VEG),
                    ("Ghee Roast Masala Dosa", 13500, FoodType.VEG),
                    ("Onion Rava Dosa", 12500, FoodType.VEG),
                    ("Podi Onion Uttapam", 11500, FoodType.VEG),
                    ("Vegetable Cutlet (2 pcs)", 7000, FoodType.VEG),
                    ("Paneer 65 Crispy", 18500, FoodType.VEG),
                ],
            ),
            (
                "Mains & Traditional Meals",
                [
                    ("Mini Tiffin Sampler", 19500, FoodType.VEG),
                    ("Bisi Bele Bath with Boondi", 14500, FoodType.VEG),
                    ("Traditional Sambar Rice", 13000, FoodType.VEG),
                    ("Curd Rice with Pomegranate", 11000, FoodType.VEG),
                    ("Paneer Butter Masala", 24000, FoodType.VEG),
                    ("Dal Tadka", 18000, FoodType.VEG),
                    ("Malabar Parotta (2 pcs)", 8000, FoodType.VEG),
                    ("Butter Naan", 6000, FoodType.VEG),
                ],
            ),
            (
                "Desserts & Coolers",
                [
                    ("Elaneer Payasam", 12000, FoodType.VEG),
                    ("Hot Gulab Jamun (2 pcs)", 8500, FoodType.VEG),
                    ("Traditional Mysore Pak", 9000, FoodType.VEG),
                    ("Madurai Jigarthanda Special", 14000, FoodType.VEG),
                    ("Fresh Mango Lassi", 11000, FoodType.VEG),
                    ("Fresh Lime Soda (Sweet/Salt)", 6000, FoodType.VEG),
                    ("Rose Milk Kulukki", 8000, FoodType.VEG),
                ],
            ),
        ]

        items_map = {}
        for cat_name, dishes in menu_catalog:
            cat, _ = MenuCategory.objects.get_or_create(tenant=t, name=cat_name)
            for dish_name, price, ftype in dishes:
                item, _ = MenuItem.objects.get_or_create(
                    tenant=t,
                    category=cat,
                    name=dish_name,
                    defaults={"base_price_paise": price, "food_type": ftype, "is_active": True},
                )
                items_map[dish_name] = item

        # Past Seeded Invoices for today (Demonstrates live Sales Dashboard)
        now = timezone.now()
        historical_bills = [
            ("CASH", [("South Indian Filter Coffee", 4), ("Ghee Podi Idli (2 pcs)", 2)], 15),
            ("UPI", [("Ghee Roast Masala Dosa", 2), ("South Indian Filter Coffee", 2)], 35),
            ("UPI", [("Mini Tiffin Sampler", 2), ("Masala Chai", 2)], 55),
            (
                "CARD",
                [
                    ("Paneer Butter Masala", 1),
                    ("Malabar Parotta (2 pcs)", 2),
                    ("Elaneer Payasam", 2),
                ],
                90,
            ),
            ("CASH", [("Onion Rava Dosa", 2), ("Fresh Mango Lassi", 2)], 120),
            ("UPI", [("Bisi Bele Bath with Boondi", 3), ("South Indian Filter Coffee", 3)], 180),
        ]

        inv_idx = 1
        for p_method, lines, minutes_ago in historical_bills:
            bill_time = now - timedelta(minutes=minutes_ago)
            inv_num = f"GKC-{now.strftime('%Y%m')}-{inv_idx:04d}"
            subtotal = sum(items_map[name].base_price_paise * q for name, q in lines)

            snap_lines = [
                {
                    "item_name": name,
                    "quantity": q,
                    "unit_price_paise": items_map[name].base_price_paise,
                    "subtotal_paise": items_map[name].base_price_paise * q,
                }
                for name, q in lines
            ]

            BillInvoice.objects.get_or_create(
                tenant=t,
                invoice_number=inv_num,
                defaults={
                    "branch": b,
                    "subtotal_paise": subtotal,
                    "total_paise": subtotal,
                    "discount_paise": 0,
                    "payment_method": p_method,
                    "amount_tendered_paise": subtotal,
                    "change_due_paise": 0,
                    "is_settled": True,
                    "settled_at": bill_time,
                    "snapshot_lines": snap_lines,
                },
            )
            inv_idx += 1

        # One Live Open Session on Table T1 for demo walkthrough
        t1 = tables[0]
        t1.status = TableStatus.OCCUPIED
        t1.save()

        sess_t1, _ = TableSession.objects.get_or_create(
            tenant=t,
            table=t1,
            status="OPEN",
            defaults={"branch": b, "session_code": "SES-T1-DEMO", "guest_count": 2},
        )

        # Place live demo order on T1
        if not Order.objects.filter(table_session=sess_t1).exists():
            order_demo = Order.objects.create(
                tenant=t,
                branch=b,
                order_number="ORD-DEMO-001",
                table_session=sess_t1,
                order_workflow=OrderWorkflow.TABLE_SERVICE,
                status=OrderStatus.PLACED,
                placed_by=users_map[Role.WAITER][1],
                notes="Less spicy, extra chutney please",
            )
            OrderItem.objects.create(
                order=order_demo,
                menu_item=items_map["Ghee Roast Masala Dosa"],
                item_name="Ghee Roast Masala Dosa",
                quantity=1,
                unit_price_paise=13500,
                subtotal_paise=13500,
                course=CourseType.MAIN,
                status="COOKING",
            )
            OrderItem.objects.create(
                order=order_demo,
                menu_item=items_map["South Indian Filter Coffee"],
                item_name="South Indian Filter Coffee",
                quantity=2,
                unit_price_paise=4500,
                subtotal_paise=9000,
                course=CourseType.BEVERAGE,
                status="COOKING",
            )
            OrderEvent.objects.create(
                tenant=t,
                branch=b,
                order=order_demo,
                event_type=OrderEventType.CREATED,
                to_status=OrderStatus.PLACED,
                user=users_map[Role.WAITER][1],
                notes="Demo live order placed",
            )

    def _seed_madras_chai(self, plan: Plan):
        self.stdout.write("Configuring 'Madras Chai Point'...")
        t, _ = Tenant.objects.get_or_create(
            slug="madras-chai",
            defaults={"name": "Madras Chai Point", "status": Tenant.Status.ACTIVE},
        )
        set_current_tenant(t)

        BusinessSettings.objects.get_or_create(
            tenant=t,
            defaults={
                "tax_mode": BusinessSettings.TaxMode.INCLUSIVE,
                "invoice_prefix": "MCP-",
                "legal_name": "Madras Chai Point Retail",
                "brand_primary_color": "#D97706",
                "receipt_footer_text": "Hot Chai, Fast Service! Have a great day.",
            },
        )

        Subscription.objects.get_or_create(
            tenant=t,
            defaults={"plan": plan, "status": SubscriptionStatus.ACTIVE},
        )

        b, _ = Branch.objects.get_or_create(
            tenant=t,
            name="Express Kiosk",
            defaults={"is_active": True},
        )

        # Counter Cashier & Kitchen staff
        for email, full_name, role in [
            ("cashier@madraschai.com", "Anand Babu", Role.CASHIER),
            ("kitchen@madraschai.com", "Master Selvam", Role.KITCHEN),
            ("owner@madraschai.com", "Vignesh Raj", Role.OWNER),
        ]:
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(
                    email=email, password="Password123!", full_name=full_name
                )
            else:
                user.set_password("Password123!")
                user.save()
            Membership.objects.get_or_create(
                user=user, tenant=t, defaults={"role": role, "is_active": True}
            )

        # Menu
        cat, _ = MenuCategory.objects.get_or_create(tenant=t, name="Chai & Snacks")
        chai_items = [
            ("Kullad Masala Chai", 2500),
            ("Ginger Elaichi Chai", 3000),
            ("Bun Maska with Jam", 4500),
            ("Hot Samosa (2 pcs)", 4000),
            ("Osmania Chai Biscuits (4 pcs)", 2000),
        ]
        for name, price in chai_items:
            MenuItem.objects.get_or_create(
                tenant=t,
                category=cat,
                name=name,
                defaults={"base_price_paise": price, "food_type": FoodType.VEG, "is_active": True},
            )
