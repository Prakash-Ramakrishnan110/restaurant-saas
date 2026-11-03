import concurrent.futures

import pytest
from django.db import connection

from apps.venues.services import next_token


@pytest.mark.django_db(transaction=True)
def test_token_counter_concurrency(venue_test_setup):
    """Concurrency test: simulate 20 parallel threads calling next_token.

    Assert exactly 20 distinct sequential integers without duplicates or gaps.
    """
    branch = venue_test_setup["branch_a1"]
    area = venue_test_setup["area_a1"]

    num_threads = 20

    def get_token():
        # Close connection so each thread gets its own db connection from pool
        connection.close()
        try:
            from apps.core.context import set_current_tenant

            set_current_tenant(branch.tenant)
            return next_token(branch=branch, service_area=area)
        finally:
            connection.close()

    tokens = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(get_token) for _ in range(num_threads)]
        for f in concurrent.futures.as_completed(futures):
            tokens.append(f.result())

    # Assert no duplicates
    assert len(tokens) == num_threads
    assert len(set(tokens)) == num_threads

    # Assert perfectly sequential from 1 to 20
    assert sorted(tokens) == list(range(1, num_threads + 1))


@pytest.mark.django_db
def test_token_counter_scoping_and_reset(venue_test_setup):
    from apps.core.context import set_current_tenant
    from apps.venues.constants import AreaType
    from apps.venues.models import ServiceArea

    branch = venue_test_setup["branch_a1"]
    area1 = venue_test_setup["area_a1"]
    tenant = venue_test_setup["tenant_a"]
    set_current_tenant(tenant)

    # Area 2 in same branch
    area2 = ServiceArea.objects.create(
        tenant=tenant,
        branch=branch,
        name="Dessert Counter",
        area_type=AreaType.TAKEAWAY,
    )

    # Area 1 gets tokens 1, 2
    t1_1 = next_token(branch=branch, service_area=area1)
    t1_2 = next_token(branch=branch, service_area=area1)
    assert t1_1 == 1
    assert t1_2 == 2

    # Area 2 gets its own independent counter starting from 1
    t2_1 = next_token(branch=branch, service_area=area2)
    assert t2_1 == 1

    # Daily reset: next_token with reset_date simulation
    from datetime import date, timedelta

    tomorrow = date.today() + timedelta(days=1)
    t1_tomorrow = next_token(branch=branch, service_area=area1, for_date=tomorrow)
    assert t1_tomorrow == 1
