import pytest

from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.subscriptions.services import is_tenant_allowed
from apps.tenants.models import Tenant


@pytest.mark.django_db
def test_subscription_gate_allowed_statuses():
    tenant = Tenant.objects.create(name="T1", slug="t1", status=Tenant.Status.ACTIVE)
    sub = Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.TRIAL)

    # TRIAL
    assert is_tenant_allowed(tenant) is True

    # ACTIVE
    sub.status = SubscriptionStatus.ACTIVE
    sub.save()
    assert is_tenant_allowed(tenant) is True

    # EXPIRING
    sub.status = SubscriptionStatus.EXPIRING
    sub.save()
    assert is_tenant_allowed(tenant) is True

    # GRACE
    sub.status = SubscriptionStatus.GRACE
    sub.save()
    assert is_tenant_allowed(tenant) is True


@pytest.mark.django_db
def test_subscription_gate_disallowed_statuses():
    tenant = Tenant.objects.create(name="T2", slug="t2", status=Tenant.Status.ACTIVE)
    sub = Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.EXPIRED)

    # EXPIRED
    assert is_tenant_allowed(tenant) is False

    # SUSPENDED
    sub.status = SubscriptionStatus.SUSPENDED
    sub.save()
    assert is_tenant_allowed(tenant) is False


@pytest.mark.django_db
def test_subscription_gate_suspended_tenant():
    tenant = Tenant.objects.create(name="T3", slug="t3", status=Tenant.Status.SUSPENDED)
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)

    # Even if subscription is ACTIVE, suspended tenant is rejected
    assert is_tenant_allowed(tenant) is False


def test_subscription_gate_none():
    assert is_tenant_allowed(None) is False
