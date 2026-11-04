import concurrent.futures
from datetime import date

import pytest
from django.db import IntegrityError, connection
from freezegun import freeze_time

from apps.core.context import reset_current_tenant, set_current_tenant
from apps.venues.models import TokenCounter
from apps.venues.services import next_token


@pytest.mark.django_db
def test_token_counter_duplicate_null_service_area_raises_integrity_error(venue_test_setup):
    """(a) Inserting a duplicate (branch, date, NULL area) row raises IntegrityError."""
    branch = venue_test_setup["branch_a1"]
    tenant = venue_test_setup["tenant_a"]
    ctx_token = set_current_tenant(tenant)
    try:
        target_date = date(2026, 11, 4)
        TokenCounter.objects.create(
            tenant=tenant,
            branch=branch,
            service_date=target_date,
            service_area=None,
            last_number=1,
        )
        with pytest.raises(IntegrityError):
            TokenCounter.objects.create(
                tenant=tenant,
                branch=branch,
                service_date=target_date,
                service_area=None,
                last_number=2,
            )
    finally:
        reset_current_tenant(ctx_token)


@pytest.mark.django_db(transaction=True)
def test_token_counter_cold_start_concurrency_null_area(venue_test_setup):
    """(b) COLD START concurrency with service_area=None:
    No pre-existing counter row, 20 threads, repeated in a loop 5 times with fresh dates,
    always unique numbers 1..20.
    """
    branch = venue_test_setup["branch_a1"]
    num_threads = 20

    for day_offset in range(5):
        frozen_dt = f"2026-11-{10 + day_offset:02d} 10:00:00"
        with freeze_time(frozen_dt):
            assert (
                TokenCounter.unscoped.filter(
                    branch=branch,
                    service_date=date(2026, 11, 10 + day_offset),
                    service_area__isnull=True,
                ).count()
                == 0
            )

            def get_token():
                connection.close()
                try:
                    set_current_tenant(branch.tenant)
                    return next_token(branch=branch, service_area=None)
                finally:
                    connection.close()

            tokens = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
                futures = [executor.submit(get_token) for _ in range(num_threads)]
                for f in concurrent.futures.as_completed(futures):
                    tokens.append(f.result())

            assert len(tokens) == num_threads
            assert len(set(tokens)) == num_threads
            assert sorted(tokens) == list(range(1, num_threads + 1))
            assert (
                TokenCounter.unscoped.filter(
                    branch=branch,
                    service_date=date(2026, 11, 10 + day_offset),
                    service_area__isnull=True,
                ).count()
                == 1
            )


@pytest.mark.django_db(transaction=True)
def test_token_counter_cold_start_concurrency_with_service_area(venue_test_setup):
    """(c) COLD START concurrency with non-null service_area:
    No pre-existing counter row, 20 threads, repeated in a loop 5 times with fresh dates,
    always unique numbers 1..20.
    """
    branch = venue_test_setup["branch_a1"]
    area = venue_test_setup["area_a1"]
    num_threads = 20

    for day_offset in range(5):
        frozen_dt = f"2026-11-{20 + day_offset:02d} 10:00:00"
        with freeze_time(frozen_dt):
            assert (
                TokenCounter.unscoped.filter(
                    branch=branch,
                    service_date=date(2026, 11, 20 + day_offset),
                    service_area=area,
                ).count()
                == 0
            )

            def get_token():
                connection.close()
                try:
                    set_current_tenant(branch.tenant)
                    return next_token(branch=branch, service_area=area)
                finally:
                    connection.close()

            tokens = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
                futures = [executor.submit(get_token) for _ in range(num_threads)]
                for f in concurrent.futures.as_completed(futures):
                    tokens.append(f.result())

            assert len(tokens) == num_threads
            assert len(set(tokens)) == num_threads
            assert sorted(tokens) == list(range(1, num_threads + 1))
            assert (
                TokenCounter.unscoped.filter(
                    branch=branch,
                    service_date=date(2026, 11, 20 + day_offset),
                    service_area=area,
                ).count()
                == 1
            )


@pytest.mark.django_db
def test_token_counter_scoping_and_reset(venue_test_setup):
    from apps.venues.constants import AreaType
    from apps.venues.models import ServiceArea

    branch = venue_test_setup["branch_a1"]
    area1 = venue_test_setup["area_a1"]
    tenant = venue_test_setup["tenant_a"]
    ctx_token = set_current_tenant(tenant)

    try:
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
    finally:
        reset_current_tenant(ctx_token)


@pytest.mark.django_db
def test_token_counter_daily_reset_ist_midnight(venue_test_setup):
    """Daily reset follows tenant timezone: 18:29 UTC (23:59 IST) and 18:31 UTC (00:01 IST)
    are different service dates, resetting to 1 at IST midnight.
    """
    branch = venue_test_setup["branch_a1"]
    area = venue_test_setup["area_a1"]
    branch.tenant.timezone = "Asia/Kolkata"
    branch.tenant.save(update_fields=["timezone"])

    # 1. 23:59 IST (18:29 UTC)
    with freeze_time("2026-11-03 18:29:00"):
        t1 = next_token(branch=branch, service_area=area)
        t2 = next_token(branch=branch, service_area=area)
        assert t1 == 1
        assert t2 == 2

    # 2. 00:01 IST (18:31 UTC) - Next calendar day in Asia/Kolkata
    with freeze_time("2026-11-03 18:31:00"):
        t_next_day = next_token(branch=branch, service_area=area)
        assert t_next_day == 1


@pytest.mark.django_db
def test_token_counter_daily_reset_custom_timezone(venue_test_setup):
    """A tenant in another timezone (e.g. America/New_York, UTC-5) resets at its own midnight."""
    branch = venue_test_setup["branch_b1"]
    area = venue_test_setup["area_b1"]
    branch.tenant.timezone = "America/New_York"
    branch.tenant.save(update_fields=["timezone"])

    # 23:59 in New York is 04:59 UTC next day
    with freeze_time("2026-11-04 04:59:00"):
        t1 = next_token(branch=branch, service_area=area)
        t2 = next_token(branch=branch, service_area=area)
        assert t1 == 1
        assert t2 == 2

    # 00:01 in New York is 05:01 UTC next day
    with freeze_time("2026-11-04 05:01:00"):
        t_ny_next_day = next_token(branch=branch, service_area=area)
        assert t_ny_next_day == 1
