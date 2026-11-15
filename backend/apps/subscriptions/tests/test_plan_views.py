import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.subscriptions.models import Plan

User = get_user_model()


@pytest.mark.django_db
def test_plan_list_create_and_patch_platform_admin_only():
    admin = User.objects.create_user(
        email="platadmin-sub@test.com", password="Password123!", is_platform_admin=True
    )
    regular = User.objects.create_user(
        email="regular-sub@test.com", password="Password123!", is_platform_admin=False
    )

    c_reg = APIClient()
    c_reg.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(regular).access_token}")

    c_adm = APIClient()
    c_adm.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")

    # Non-admin forbidden
    assert (
        c_reg.post("/api/v1/plans/", {"name": "Starter"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        c_reg.patch(f"/api/v1/plans/{uuid.uuid4()}/", {"name": "X"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Validation & duplicate slug
    assert (
        c_adm.post("/api/v1/plans/", {"name": ""}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )
    res_ok = c_adm.post(
        "/api/v1/plans/",
        {
            "name": "Cafe Plus",
            "price_paise": 199900,
            "entitlements": {"max_branches": 2},
            "is_active": True,
        },
        format="json",
    )
    assert res_ok.status_code == status.HTTP_201_CREATED
    plan_id = res_ok.data["id"]

    assert (
        c_adm.post("/api/v1/plans/", {"name": "Cafe Plus"}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )

    # Patch not found + patch ok
    assert (
        c_adm.patch(f"/api/v1/plans/{uuid.uuid4()}/", {"name": "Nope"}, format="json").status_code
        == status.HTTP_404_NOT_FOUND
    )
    res_patch = c_adm.patch(
        f"/api/v1/plans/{plan_id}/",
        {
            "name": "Cafe Pro",
            "price_paise": 249900,
            "entitlements": {"max_branches": 3},
            "is_active": False,
        },
        format="json",
    )
    assert res_patch.status_code == status.HTTP_200_OK
    assert res_patch.data["name"] == "Cafe Pro"
    assert Plan.objects.get(id=plan_id).is_active is False
