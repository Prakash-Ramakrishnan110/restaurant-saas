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
        from apps.core.context import set_current_tenant

        set_current_tenant(branch.tenant)
        return next_token(branch=branch, service_area=area)

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
