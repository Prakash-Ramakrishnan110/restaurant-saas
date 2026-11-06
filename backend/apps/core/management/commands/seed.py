from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Membership
from apps.core.context import set_current_tenant
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import (
    AreaType,
    QRTargetType,
    SectionType,
    TableStatus,
    TableType,
)
from apps.venues.models import (
    DiningTable,
    QRCode,
    Section,
    ServiceArea,
    StaffSectionAssignment,
)
from apps.venues.services import apply_preset, generate_qr_code, next_token

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Seeds database with platform admin, 4 tiered subscription plans, and 5 demo venue tenants."
    )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write("Starting database seeding...")
        default_password = "Password123!"

        # 1. Platform Admin
        admin_email = "admin@fusionengine.in"
        admin_user, _ = User.objects.get_or_create(
            email=admin_email,
            defaults={
                "full_name": "Platform Administrator",
                "is_platform_admin": True,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        admin_user.set_password("AdminPassword123!")
        admin_user.is_platform_admin = True
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()
        self.stdout.write(
            self.style.SUCCESS(f"Platform admin ready: {admin_email} / AdminPassword123!")
        )

        # 2. Seed 4 Subscription Plans
        plans_data = [
            {
                "slug": "starter",
                "name": "Starter Plan",
                "price_paise": 99900,
                "entitlements": {
                    "max_branches": 1,
                    "max_service_areas": 1,
                    "max_tables": 15,
                    "floor_editor": False,
                    "table_merge": False,
                    "courses": False,
                },
            },
            {
                "slug": "professional",
                "name": "Professional Plan",
                "price_paise": 299900,
                "entitlements": {
                    "max_branches": 3,
                    "max_service_areas": 3,
                    "max_tables": 50,
                    "floor_editor": True,
                    "table_merge": True,
                    "courses": False,
                },
            },
            {
                "slug": "business",
                "name": "Business Plan",
                "price_paise": 799900,
                "entitlements": {
                    "max_branches": 10,
                    "max_service_areas": 10,
                    "max_tables": 200,
                    "floor_editor": True,
                    "table_merge": True,
                    "courses": True,
                },
            },
            {
                "slug": "enterprise",
                "name": "Enterprise Plan",
                "price_paise": 1999900,
                "entitlements": {
                    "max_branches": -1,
                    "max_service_areas": -1,
                    "max_tables": -1,
                    "floor_editor": True,
                    "table_merge": True,
                    "courses": True,
                },
            },
        ]
        plans: dict[str, Plan] = {}
        for p in plans_data:
            plan_obj, _ = Plan.objects.get_or_create(
                slug=p["slug"],
                defaults={
                    "name": p["name"],
                    "price_paise": p["price_paise"],
                    "entitlements": p["entitlements"],
                    "is_active": True,
                },
            )
            plan_obj.entitlements = p["entitlements"]
            plan_obj.save(update_fields=["entitlements"])
            plans[str(p["slug"])] = plan_obj

        # 3. Demo Tenants Specification
        # Tenant 1: Chai Corner (TEA_SHOP, Starter)
        t1, _ = Tenant.objects.get_or_create(
            slug="chai-corner",
            defaults={
                "name": "Chai Corner",
                "business_type": Tenant.BusinessType.TEA_SHOP,
                "email": "contact@chaicorner.in",
                "phone": "+91 98765 00001",
                "address": "Koramangala 4th Block, Bengaluru",
                "status": Tenant.Status.ACTIVE,
            },
        )
        set_current_tenant(t1)
        BusinessSettings.objects.get_or_create(
            tenant=t1,
            defaults={"tax_mode": BusinessSettings.TaxMode.INCLUSIVE, "invoice_prefix": "CC-"},
        )
        Subscription.objects.update_or_create(
            tenant=t1,
            defaults={"plan": plans["starter"], "status": SubscriptionStatus.ACTIVE},
        )
        b1, _ = Branch.objects.get_or_create(
            tenant=t1,
            name="Chai Corner Koramangala",
            defaults={
                "venue_profile": Branch.VenueProfile.QUICK_SERVICE,
                "address": "80ft Road, Koramangala, Bengaluru",
                "phone": "+91 98765 00001",
                "is_active": True,
            },
        )
        apply_preset(b1, Branch.VenueProfile.QUICK_SERVICE)
        sa1, _ = ServiceArea.objects.get_or_create(
            tenant=t1,
            branch=b1,
            name="Takeaway Counter",
            defaults={"area_type": AreaType.TAKEAWAY},
        )
        next_token(b1, sa1)
        u1_owner, _ = User.objects.get_or_create(
            email="owner@chaicorner.in",
            defaults={"full_name": "Ramesh Chaiwala", "is_active": True},
        )
        u1_owner.set_password(default_password)
        u1_owner.save()
        Membership.objects.get_or_create(
            user=u1_owner, tenant=t1, defaults={"role": Role.OWNER, "is_active": True}
        )
        u1_cashier, _ = User.objects.get_or_create(
            email="cashier@chaicorner.in",
            defaults={"full_name": "Suresh Cashier", "is_active": True},
        )
        u1_cashier.set_password(default_password)
        u1_cashier.save()
        Membership.objects.get_or_create(
            user=u1_cashier, tenant=t1, defaults={"role": Role.CASHIER, "is_active": True}
        )

        # Tenant 2: Bean & Bloom Cafe (CAFE, Starter)
        t2, _ = Tenant.objects.get_or_create(
            slug="bean-bloom",
            defaults={
                "name": "Bean & Bloom Cafe",
                "business_type": Tenant.BusinessType.CAFE,
                "email": "hello@beanbloom.in",
                "phone": "+91 98765 00002",
                "address": "12th Main, Indiranagar, Bengaluru",
                "status": Tenant.Status.ACTIVE,
            },
        )
        set_current_tenant(t2)
        BusinessSettings.objects.get_or_create(
            tenant=t2,
            defaults={"tax_mode": BusinessSettings.TaxMode.INCLUSIVE, "invoice_prefix": "BB-"},
        )
        Subscription.objects.update_or_create(
            tenant=t2,
            defaults={"plan": plans["starter"], "status": SubscriptionStatus.ACTIVE},
        )
        b2, _ = Branch.objects.get_or_create(
            tenant=t2,
            name="Bean & Bloom Indiranagar",
            defaults={
                "venue_profile": Branch.VenueProfile.CAFE,
                "address": "12th Main, Indiranagar, Bengaluru",
                "phone": "+91 98765 00002",
                "is_active": True,
            },
        )
        apply_preset(b2, Branch.VenueProfile.CAFE)
        sa2, _ = ServiceArea.objects.get_or_create(
            tenant=t2,
            branch=b2,
            name="Indoor Dining",
            defaults={"area_type": AreaType.DINING},
        )
        sec2, _ = Section.objects.get_or_create(
            tenant=t2,
            branch=b2,
            service_area=sa2,
            name="Main Cafe",
            defaults={"color": "#10B981", "section_type": SectionType.INDOOR, "is_active": True},
        )
        for i in range(1, 16):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t2,
                branch=b2,
                label=f"T{i}",
                defaults={
                    "section": sec2,
                    "capacity": 4,
                    "status": TableStatus.AVAILABLE,
                    "x": (i % 4) * 120.0 + 40.0,
                    "y": (i // 4) * 120.0 + 40.0,
                },
            )
            if not QRCode.objects.filter(table=tbl, is_active=True).exists():
                generate_qr_code(branch=b2, target_type=QRTargetType.TABLE, table=tbl)

        u2_owner, _ = User.objects.get_or_create(
            email="owner@beanbloom.in", defaults={"full_name": "Aarav Bloom", "is_active": True}
        )
        u2_owner.set_password(default_password)
        u2_owner.save()
        Membership.objects.get_or_create(
            user=u2_owner, tenant=t2, defaults={"role": Role.OWNER, "is_active": True}
        )
        u2_waiter, _ = User.objects.get_or_create(
            email="waiter@beanbloom.in", defaults={"full_name": "Pooja Waiter", "is_active": True}
        )
        u2_waiter.set_password(default_password)
        u2_waiter.save()
        Membership.objects.get_or_create(
            user=u2_waiter, tenant=t2, defaults={"role": Role.WAITER, "is_active": True}
        )

        # Tenant 3: Spice Garden (RESTAURANT, Professional)
        t3, _ = Tenant.objects.get_or_create(
            slug="spice-garden",
            defaults={
                "name": "Spice Garden",
                "business_type": Tenant.BusinessType.RESTAURANT,
                "email": "contact@spicegarden.com",
                "phone": "+91 98765 43210",
                "address": "100ft Road, Indiranagar, Bengaluru",
                "status": Tenant.Status.ACTIVE,
            },
        )
        set_current_tenant(t3)
        BusinessSettings.objects.get_or_create(
            tenant=t3,
            defaults={"tax_mode": BusinessSettings.TaxMode.INCLUSIVE, "invoice_prefix": "SG-"},
        )
        Subscription.objects.update_or_create(
            tenant=t3,
            defaults={"plan": plans["professional"], "status": SubscriptionStatus.ACTIVE},
        )
        b3, _ = Branch.objects.get_or_create(
            tenant=t3,
            name="Spice Garden Indiranagar",
            defaults={
                "venue_profile": Branch.VenueProfile.CASUAL_DINING,
                "address": "100ft Road, Indiranagar, Bengaluru",
                "phone": "+91 98765 43210",
                "is_active": True,
            },
        )
        apply_preset(b3, Branch.VenueProfile.CASUAL_DINING)
        sa3_ac, _ = ServiceArea.objects.get_or_create(
            tenant=t3,
            branch=b3,
            name="AC Hall",
            defaults={"area_type": AreaType.DINING, "service_charge_bps": 500},
        )
        sec3_ac, _ = Section.objects.get_or_create(
            tenant=t3,
            branch=b3,
            service_area=sa3_ac,
            name="Family AC",
            defaults={"color": "#3B82F6", "section_type": SectionType.INDOOR, "is_active": True},
        )
        sa3_patio, _ = ServiceArea.objects.get_or_create(
            tenant=t3,
            branch=b3,
            name="Garden Patio",
            defaults={"area_type": AreaType.OUTDOOR},
        )
        sec3_patio, _ = Section.objects.get_or_create(
            tenant=t3,
            branch=b3,
            service_area=sa3_patio,
            name="Patio Open",
            defaults={"color": "#F59E0B", "section_type": SectionType.OUTDOOR, "is_active": True},
        )
        for i in range(1, 16):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t3,
                branch=b3,
                label=f"T{i}",
                defaults={"section": sec3_ac, "capacity": 4, "status": TableStatus.AVAILABLE},
            )
            if not QRCode.objects.filter(table=tbl, is_active=True).exists():
                generate_qr_code(branch=b3, target_type=QRTargetType.TABLE, table=tbl)
        for i in range(16, 31):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t3,
                branch=b3,
                label=f"T{i}",
                defaults={"section": sec3_patio, "capacity": 6, "status": TableStatus.AVAILABLE},
            )
            if not QRCode.objects.filter(table=tbl, is_active=True).exists():
                generate_qr_code(branch=b3, target_type=QRTargetType.TABLE, table=tbl)

        u3_owner, _ = User.objects.get_or_create(
            email="owner@spicegarden.com", defaults={"full_name": "Rajesh Kumar", "is_active": True}
        )
        u3_owner.set_password(default_password)
        u3_owner.save()
        Membership.objects.get_or_create(
            user=u3_owner, tenant=t3, defaults={"role": Role.OWNER, "is_active": True}
        )
        u3_mgr, _ = User.objects.get_or_create(
            email="manager@spicegarden.com", defaults={"full_name": "Sunil V", "is_active": True}
        )
        u3_mgr.set_password(default_password)
        u3_mgr.save()
        Membership.objects.get_or_create(
            user=u3_mgr, tenant=t3, defaults={"role": Role.BRANCH_MANAGER, "is_active": True}
        )
        u3_waiter, _ = User.objects.get_or_create(
            email="waiter@spicegarden.com", defaults={"full_name": "Ramesh P", "is_active": True}
        )
        u3_waiter.set_password(default_password)
        u3_waiter.save()
        m3_waiter, _ = Membership.objects.get_or_create(
            user=u3_waiter, tenant=t3, defaults={"role": Role.WAITER, "is_active": True}
        )
        StaffSectionAssignment.objects.get_or_create(
            tenant=t3,
            branch=b3,
            membership=m3_waiter,
            section=sec3_ac,
        )

        # Tenant 4: Grand Meridian (HOTEL_RESTAURANT, Enterprise)
        t4, _ = Tenant.objects.get_or_create(
            slug="grand-meridian",
            defaults={
                "name": "Grand Meridian",
                "business_type": Tenant.BusinessType.HOTEL,
                "email": "info@grandmeridian.com",
                "phone": "+91 98765 00004",
                "address": "Residency Road, Bengaluru",
                "status": Tenant.Status.ACTIVE,
            },
        )
        set_current_tenant(t4)
        BusinessSettings.objects.get_or_create(
            tenant=t4,
            defaults={"tax_mode": BusinessSettings.TaxMode.EXCLUSIVE, "invoice_prefix": "GM-"},
        )
        Subscription.objects.update_or_create(
            tenant=t4,
            defaults={"plan": plans["enterprise"], "status": SubscriptionStatus.ACTIVE},
        )
        b4, _ = Branch.objects.get_or_create(
            tenant=t4,
            name="Grand Meridian Palace",
            defaults={
                "venue_profile": Branch.VenueProfile.HOTEL_RESTAURANT,
                "address": "Residency Road, Bengaluru",
                "phone": "+91 98765 00004",
                "is_active": True,
            },
        )
        apply_preset(b4, Branch.VenueProfile.HOTEL_RESTAURANT)
        sa4_dining, _ = ServiceArea.objects.get_or_create(
            tenant=t4,
            branch=b4,
            name="Main Dining",
            defaults={"area_type": AreaType.DINING, "service_charge_bps": 1000},
        )
        sa4_bar, _ = ServiceArea.objects.get_or_create(
            tenant=t4,
            branch=b4,
            name="Poolside Bar",
            defaults={"area_type": AreaType.BAR},
        )
        sa4_room, _ = ServiceArea.objects.get_or_create(
            tenant=t4,
            branch=b4,
            name="Room Service",
            defaults={"area_type": AreaType.ROOM_SERVICE},
        )
        sec4_room, _ = Section.objects.get_or_create(
            tenant=t4,
            branch=b4,
            service_area=sa4_room,
            name="Guest Rooms Tower A",
            defaults={"color": "#8B5CF6", "section_type": SectionType.PRIVATE_ROOM, "is_active": True},
        )
        for r_num in range(101, 121):
            tbl, _ = DiningTable.objects.get_or_create(
                tenant=t4,
                branch=b4,
                label=f"Room {r_num}",
                defaults={
                    "section": sec4_room,
                    "table_type": TableType.ROOM,
                    "capacity": 2,
                    "status": TableStatus.AVAILABLE,
                },
            )
            if not QRCode.objects.filter(table=tbl, is_active=True).exists():
                generate_qr_code(branch=b4, target_type=QRTargetType.ROOM, table=tbl)

        u4_owner, _ = User.objects.get_or_create(
            email="owner@grandmeridian.com",
            defaults={"full_name": "Vikramaditya Oberoi", "is_active": True},
        )
        u4_owner.set_password(default_password)
        u4_owner.save()
        Membership.objects.get_or_create(
            user=u4_owner, tenant=t4, defaults={"role": Role.OWNER, "is_active": True}
        )

        # Tenant 5: Foodie Plaza (FOOD_COURT, Business)
        t5, _ = Tenant.objects.get_or_create(
            slug="foodie-plaza",
            defaults={
                "name": "Foodie Plaza",
                "business_type": Tenant.BusinessType.FOOD_COURT,
                "email": "operations@foodieplaza.in",
                "phone": "+91 98765 00005",
                "address": "Phoenix Marketcity, Whitefield, Bengaluru",
                "status": Tenant.Status.ACTIVE,
            },
        )
        set_current_tenant(t5)
        BusinessSettings.objects.get_or_create(
            tenant=t5,
            defaults={"tax_mode": BusinessSettings.TaxMode.INCLUSIVE, "invoice_prefix": "FP-"},
        )
        Subscription.objects.update_or_create(
            tenant=t5,
            defaults={"plan": plans["business"], "status": SubscriptionStatus.ACTIVE},
        )
        b5, _ = Branch.objects.get_or_create(
            tenant=t5,
            name="Foodie Plaza Central",
            defaults={
                "venue_profile": Branch.VenueProfile.FOOD_COURT,
                "address": "Phoenix Marketcity, Whitefield, Bengaluru",
                "phone": "+91 98765 00005",
                "is_active": True,
            },
        )
        apply_preset(b5, Branch.VenueProfile.FOOD_COURT)
        counters = [
            "Counter 1 - South Indian",
            "Counter 2 - North Indian Tandoor",
            "Counter 3 - Chinese Wok",
            "Counter 4 - Burger & Fries",
            "Counter 5 - Woodfired Pizza",
            "Counter 6 - Chai & Desserts",
        ]
        # Clean up any legacy non-FOOD_COURT_COUNTER areas or tables on re-seed
        DiningTable.objects.filter(tenant=t5).delete()
        ServiceArea.objects.filter(tenant=t5, branch=b5).exclude(name__in=counters).delete()
        for idx, c_name in enumerate(counters, start=1):
            sa_c, _ = ServiceArea.objects.get_or_create(
                tenant=t5,
                branch=b5,
                name=c_name,
                defaults={"area_type": AreaType.FOOD_COURT_COUNTER, "sort_order": idx},
            )
            if sa_c.area_type != AreaType.FOOD_COURT_COUNTER:
                sa_c.area_type = AreaType.FOOD_COURT_COUNTER
                sa_c.save(update_fields=["area_type"])
            if not QRCode.objects.filter(
                branch=b5, target_type=QRTargetType.COUNTER, service_area=sa_c, is_active=True
            ).exists():
                generate_qr_code(branch=b5, target_type=QRTargetType.COUNTER, service_area=sa_c)
            next_token(b5, sa_c)

        u5_owner, _ = User.objects.get_or_create(
            email="owner@foodieplaza.in", defaults={"full_name": "Anil Agarwal", "is_active": True}
        )
        u5_owner.set_password(default_password)
        u5_owner.save()
        Membership.objects.get_or_create(
            user=u5_owner, tenant=t5, defaults={"role": Role.OWNER, "is_active": True}
        )
        u5_cashier, _ = User.objects.get_or_create(
            email="cashier@foodieplaza.in",
            defaults={"full_name": "Karan Cashier", "is_active": True},
        )
        u5_cashier.set_password(default_password)
        u5_cashier.save()
        Membership.objects.get_or_create(
            user=u5_cashier, tenant=t5, defaults={"role": Role.CASHIER, "is_active": True}
        )

        # Print Seed Summary Table
        self.stdout.write("\n" + "=" * 90)
        self.stdout.write("DATABASE SEEDING SUMMARY")
        self.stdout.write("=" * 90)
        self.stdout.write(
            f"{'Tenant':<22} | {'Profile':<16} | {'Plan':<14} | {'Areas':<6} | {'Tables':<7} | {'QRs':<5}"
        )
        self.stdout.write("-" * 90)

        all_tenants = [t1, t2, t3, t4, t5]
        for t in all_tenants:
            set_current_tenant(t)
            areas_count = ServiceArea.objects.filter(tenant=t).count()
            tables_count = DiningTable.objects.filter(tenant=t).count()
            qrs_count = QRCode.objects.filter(tenant=t).count()
            sub = Subscription.objects.filter(tenant=t).first()
            plan_name = sub.plan.name if sub and sub.plan else "None"
            branch = Branch.objects.filter(tenant=t).first()
            v_profile = branch.venue_profile if branch else "N/A"
            self.stdout.write(
                f"{t.name:<22} | {v_profile:<16} | {plan_name:<14} | {areas_count:<6} | {tables_count:<7} | {qrs_count:<5}"
            )
        set_current_tenant(None)

        self.stdout.write("=" * 90)
        self.stdout.write(
            self.style.SUCCESS(
                "Database seeding completed successfully! All 5 venue profiles seeded successfully! Demo password: Password123!"
            )
        )
