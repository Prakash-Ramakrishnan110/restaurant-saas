from decimal import Decimal

import pytest

from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import OrderSource, OrderWorkflow, PaymentMethod
from apps.orders.serializers import BillInvoiceSerializer
from apps.orders.services import calculate_bill, create_order, settle_bill
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import TableType
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession


@pytest.mark.django_db
def test_tax_inclusive_and_exclusive_food_and_hotel_room_gst():
    tenant = Tenant.objects.create(name="Spice Hotel", slug="spice-hotel", business_type="HOTEL")
    BusinessSettings.unscoped.create(
        tenant=tenant,
        legal_name="Spice Hospitality Pvt Ltd",
        gstin="33AAAAA0000A1Z5",
        tax_mode=BusinessSettings.TaxMode.INCLUSIVE,
        food_gst_percent=Decimal("5.00"),
        hotel_gst_percent=Decimal("12.00"),
        review_qr_url="https://g.page/r/spice-hotel/review",
        review_qr_label="Scan to review us",
    )
    branch = Branch.unscoped.create(tenant=tenant, name="Main")
    service_area = ServiceArea.unscoped.create(tenant=tenant, branch=branch, name="Main Floor")
    section = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=service_area, name="Hall"
    )
    table = DiningTable.unscoped.create(
        tenant=tenant,
        branch=branch,
        section=section,
        label="T1",
        table_type=TableType.TABLE,
        capacity=4,
    )
    room = DiningTable.unscoped.create(
        tenant=tenant,
        branch=branch,
        section=section,
        label="Room 201",
        table_type=TableType.ROOM,
        capacity=2,
    )
    cat = MenuCategory.objects.create(tenant=tenant, name="Meals")
    dosa = MenuItem.objects.create(
        tenant=tenant, category=cat, name="Masala Dosa", base_price_paise=10500
    )

    # 1. INCLUSIVE food GST (5% inside ₹105.00 -> taxable ₹100.00, CGST ₹2.50, SGST ₹2.50)
    sess_food = TableSession.unscoped.create(
        tenant=tenant, branch=branch, table=table, session_code="S-101"
    )
    create_order(
        branch=branch,
        table_session=sess_food,
        source=OrderSource.STAFF,
        order_workflow=OrderWorkflow.TABLE_SERVICE,
        items_data=[{"menu_item_id": str(dosa.id), "quantity": 1}],
    )
    calc_inc = calculate_bill(sess_food)
    assert calc_inc["subtotal_paise"] == 10500
    assert calc_inc["taxable_paise"] == 10000
    assert calc_inc["tax_paise"] == 500
    assert calc_inc["cgst_paise"] == 250
    assert calc_inc["sgst_paise"] == 250
    assert calc_inc["total_paise"] == 10500

    # 2. EXCLUSIVE food GST (5% added on top of ₹105.00 -> tax ₹5.25, total ₹110.25)
    bs = BusinessSettings.unscoped.get(tenant=tenant)
    bs.tax_mode = BusinessSettings.TaxMode.EXCLUSIVE
    bs.save()

    calc_exc = calculate_bill(sess_food)
    assert calc_exc["taxable_paise"] == 10500
    assert calc_exc["tax_paise"] == 525
    assert calc_exc["total_paise"] == 11025

    inv_food = settle_bill(sess_food, payment_method=PaymentMethod.UPI)
    assert inv_food.tax_paise == 525
    assert inv_food.total_paise == 11025

    data = BillInvoiceSerializer(inv_food).data
    assert data["gstin"] == "33AAAAA0000A1Z5"
    assert data["review_qr_url"] == "https://g.page/r/spice-hotel/review"
    assert data["review_qr_label"] == "Scan to review us"

    # 3. Hotel / Room folio GST (12% EXCLUSIVE on ₹105.00 -> tax ₹12.60, total ₹117.60)
    sess_room = TableSession.unscoped.create(
        tenant=tenant, branch=branch, table=room, session_code="S-201"
    )
    create_order(
        branch=branch,
        table_session=sess_room,
        source=OrderSource.STAFF,
        order_workflow=OrderWorkflow.ROOM_SERVICE,
        items_data=[{"menu_item_id": str(dosa.id), "quantity": 1}],
    )
    inv_room = settle_bill(sess_room, payment_method=PaymentMethod.ROOM_FOLIO)
    assert inv_room.tax_rate_percent == Decimal("12.00")
    assert inv_room.tax_paise == 1260
    assert inv_room.cgst_paise == 630
    assert inv_room.sgst_paise == 630
    assert inv_room.total_paise == 11760
