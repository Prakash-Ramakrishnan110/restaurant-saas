from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.tenants.models import Tenant

SEEDED_SLUGS = {
    "chai-corner",
    "bean-bloom",
    "spice-garden",
    "grand-meridian",
    "foodie-plaza",
    "artisan-bakery",
    "royal-dum-pukht",
    "pind-punjab-dhaba",
    "kaveri-cafe",
    "madras-chai",
}


class Command(BaseCommand):
    help = "Cleans up non-seeded test tenants and their dependencies to keep demo database pristine."

    def handle(self, *args, **options):
        unseeded = list(Tenant.objects.exclude(slug__in=SEEDED_SLUGS))
        count = len(unseeded)
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS("Demo database is already clean. Only seeded tenants present.")
            )
            return

        names = [t.name for t in unseeded]
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Find all tables with column tenant_id in public schema
                cursor.execute("""
                    SELECT table_name
                    FROM information_schema.columns
                    WHERE column_name = 'tenant_id'
                      AND table_schema = 'public'
                      AND table_name NOT IN ('tenants_tenant', 'audit_auditlog')
                """)
                tables = [row[0] for row in cursor.fetchall()]

                for t in unseeded:
                    t_id = str(t.id)
                    # Nullify audit log
                    cursor.execute(
                        "UPDATE audit_auditlog SET tenant_id = NULL WHERE tenant_id = %s",
                        [t_id],
                    )

                    # Delete non-tenant_id junction/child tables
                    cursor.execute("""
                        DELETE FROM accounts_membership_branches
                        WHERE branch_id IN (SELECT id FROM tenants_branch WHERE tenant_id = %s)
                           OR membership_id IN (SELECT id FROM accounts_membership WHERE tenant_id = %s)
                    """, [t_id, t_id])

                    cursor.execute("""
                        DELETE FROM orders_orderitem
                        WHERE order_id IN (SELECT id FROM orders_order WHERE tenant_id = %s)
                           OR menu_item_id IN (SELECT id FROM menu_items WHERE tenant_id = %s)
                    """, [t_id, t_id])

                    cursor.execute("""
                        DELETE FROM menu_item_variants
                        WHERE item_id IN (SELECT id FROM menu_items WHERE tenant_id = %s)
                    """, [t_id])

                    cursor.execute("""
                        DELETE FROM menu_item_option_groups
                        WHERE item_id IN (SELECT id FROM menu_items WHERE tenant_id = %s)
                           OR group_id IN (SELECT id FROM menu_option_groups WHERE tenant_id = %s)
                    """, [t_id, t_id])

                    cursor.execute("""
                        DELETE FROM menu_options
                        WHERE group_id IN (SELECT id FROM menu_option_groups WHERE tenant_id = %s)
                    """, [t_id])

                    # Delete dependent order tables
                    for tbl in [
                        "orders_orderevent", "orders_billinvoice", "orders_servicerequest",
                        "orders_order", "orders_cashiershiftcloseout", "orders_customers",
                        "venues_tablesession", "venues_staffsectionassignment", "venues_qrcode",
                        "venues_diningtable", "venues_tablegroup", "venues_tokencounter",
                        "venues_section", "venues_servicearea", "venues_branchcapabilities",
                        "menu_branch_item_availability", "menu_items", "menu_option_groups", "menu_categories",
                        "inventory_recipeitem", "inventory_recipe", "inventory_purchaseorderitem",
                        "inventory_purchaseorder", "inventory_stocktransaction", "inventory_wastagelog",
                        "inventory_ingredient", "inventory_supplier", "subscriptions_subscription",
                        "tenants_supportticket", "tenants_businesssettings",
                        "accounts_membership", "tenants_branch"
                    ]:
                        cursor.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", [t_id])

                    # Delete any remaining child records referencing tenant_id
                    for table in tables:
                        cursor.execute(f"DELETE FROM {table} WHERE tenant_id = %s", [t_id])

                    # Finally delete the tenant record
                    cursor.execute("DELETE FROM tenants_tenant WHERE id = %s", [t_id])

        self.stdout.write(
            self.style.SUCCESS(f"Cleaned up {count} test tenant(s): {', '.join(names)}")
        )
