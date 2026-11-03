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
    assert Tenant.objects.filter(slug="foodie-plaza").exists()
