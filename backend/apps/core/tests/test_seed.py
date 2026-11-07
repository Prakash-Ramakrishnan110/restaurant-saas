import io

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from apps.tenants.models import Tenant

User = get_user_model()


@pytest.mark.django_db
def test_seed_command():
    out = io.StringIO()
    call_command("seed", stdout=out)
    output = out.getvalue()
    assert "Platform admin ready" in output
    assert "Database seeding completed successfully" in output

    # Verify seeded records exist
    assert User.objects.filter(email="admin@fusionengine.in", is_platform_admin=True).exists()
    assert Tenant.objects.filter(slug="chai-corner").exists()
    assert Tenant.objects.filter(slug="bean-bloom").exists()
    assert Tenant.objects.filter(slug="spice-garden").exists()
    assert Tenant.objects.filter(slug="grand-meridian").exists()
    t_fc = Tenant.objects.filter(slug="foodie-plaza").first()
    assert t_fc is not None

    # Verify Foodie Plaza is seeded on Business plan
    from apps.subscriptions.constants import SubscriptionStatus
    from apps.subscriptions.models import Subscription

    fc_sub = Subscription.objects.filter(tenant=t_fc).first()
    assert fc_sub is not None
    assert fc_sub.status == SubscriptionStatus.ACTIVE
    assert fc_sub.plan is not None
    assert fc_sub.plan.name == "Business Plan"

    # Verify Foodie Plaza (FOOD_COURT) has 6 counters, 0 dining tables, 6 counter QR codes, and independent tokens per counter
    from apps.core.context import set_current_tenant
    from apps.tenants.models import Branch
    from apps.venues.constants import AreaType, QRTargetType
    from apps.venues.models import DiningTable, QRCode, ServiceArea
    from apps.venues.services import next_token

    set_current_tenant(t_fc)
    fc_branch = Branch.objects.get(tenant=t_fc)
    fc_counters = list(
        ServiceArea.objects.filter(
            tenant=t_fc, branch=fc_branch, area_type=AreaType.FOOD_COURT_COUNTER
        ).order_by("sort_order")
    )
    assert len(fc_counters) == 6
    assert DiningTable.objects.filter(tenant=t_fc).count() == 0
    assert (
        QRCode.objects.filter(
            tenant=t_fc, branch=fc_branch, target_type=QRTargetType.COUNTER, is_active=True
        ).count()
        == 6
    )

    # Prove tokens are independent per counter (each counter was initialized to 1 during seed)
    t_c1_a = next_token(fc_branch, fc_counters[0])
    t_c1_b = next_token(fc_branch, fc_counters[0])
    t_c2_a = next_token(fc_branch, fc_counters[1])
    assert t_c1_a == 2
    assert t_c1_b == 3
    assert t_c2_a == 2
    set_current_tenant(None)


@pytest.mark.django_db
def test_seed_demo_command():
    out = io.StringIO()
    call_command("seed_demo", stdout=out)
    output = out.getvalue()
    assert "Demo seeding completed successfully!" in output
    assert Tenant.objects.filter(slug="kaveri-cafe").exists()

    # Verify idempotency
    call_command("seed_demo", stdout=out)
    assert Tenant.objects.filter(slug="kaveri-cafe").count() == 1
