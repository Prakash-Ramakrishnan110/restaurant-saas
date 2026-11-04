import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import AreaType, TableShape, TableStatus, TableType
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession


@pytest.fixture
def matrix_env():
    tenant = Tenant.objects.create(name="Matrix Tenant", slug="matrix-tenant", status=Tenant.Status.ACTIVE)
    plan = Plan.objects.create(
        name="Enterprise",
        slug="enterprise",
        entitlements={
            "table_merge": True,
            "floor_editor": True,
            "max_service_areas": 100,
            "max_branches": 100,
            "max_tables": 100,
        },
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.objects.create(tenant=tenant, name="Matrix Branch")
    area = ServiceArea.objects.create(tenant=tenant, branch=branch, name="Main Dining", area_type=AreaType.DINING)
    sec = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name="Main Section")

    users = {}
    clients = {}
    for role in [
        Role.OWNER,
        Role.BRANCH_MANAGER,
        Role.CASHIER,
        Role.WAITER,
        Role.KITCHEN,
        Role.INVENTORY_MANAGER,
    ]:
        user = User.objects.create_user(
            email=f"{role.lower()}@matrix.com",
            password="Password123!",
            full_name=f"{role.title()} User",
        )
        mem = Membership.objects.create(user=user, tenant=tenant, role=role, is_active=True)
        if role != Role.OWNER:
            mem.branches.add(branch)

        client = APIClient()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_X_TENANT_ID=str(tenant.id),
        )
        users[role] = user
        clients[role] = client

    return {
        "tenant": tenant,
        "branch": branch,
        "area": area,
        "section": sec,
        "clients": clients,
    }


# Matrix of: (endpoint_key, method, url_builder, payload_builder, expected_role_statuses)
# Expected statuses for: OWNER, BRANCH_MANAGER, CASHIER, WAITER, KITCHEN, INVENTORY_MANAGER
MATRIX_TEST_CASES = [
    # 1. Table status update -> table.status_update (OWNER, BM, CASHIER, WAITER)
    ("table_status_transition", Role.OWNER, 200),
    ("table_status_transition", Role.BRANCH_MANAGER, 200),
    ("table_status_transition", Role.CASHIER, 200),
    ("table_status_transition", Role.WAITER, 200),
    ("table_status_transition", Role.KITCHEN, 403),
    ("table_status_transition", Role.INVENTORY_MANAGER, 403),
    # 2. Table merge / join -> table.merge (OWNER, BM, WAITER)
    ("table_merge_join", Role.OWNER, 201),
    ("table_merge_join", Role.BRANCH_MANAGER, 201),
    ("table_merge_join", Role.CASHIER, 403),
    ("table_merge_join", Role.WAITER, 201),
    ("table_merge_join", Role.KITCHEN, 403),
    ("table_merge_join", Role.INVENTORY_MANAGER, 403),
    # 3. Table session open -> table_session.open (OWNER, BM, WAITER)
    ("table_session_open", Role.OWNER, 201),
    ("table_session_open", Role.BRANCH_MANAGER, 201),
    ("table_session_open", Role.CASHIER, 403),
    ("table_session_open", Role.WAITER, 201),
    ("table_session_open", Role.KITCHEN, 403),
    ("table_session_open", Role.INVENTORY_MANAGER, 403),
    # 4. Table session close -> table_session.close (OWNER, BM, CASHIER, WAITER)
    ("table_session_close", Role.OWNER, 200),
    ("table_session_close", Role.BRANCH_MANAGER, 200),
    ("table_session_close", Role.CASHIER, 200),
    ("table_session_close", Role.WAITER, 200),
    ("table_session_close", Role.KITCHEN, 403),
    ("table_session_close", Role.INVENTORY_MANAGER, 403),
    # 5. Table CRUD create -> table.manage (OWNER, BM only)
    ("table_create", Role.OWNER, 201),
    ("table_create", Role.BRANCH_MANAGER, 201),
    ("table_create", Role.CASHIER, 403),
    ("table_create", Role.WAITER, 403),
    ("table_create", Role.KITCHEN, 403),
    ("table_create", Role.INVENTORY_MANAGER, 403),
    # 6. Floor layout -> floor.manage (OWNER, BM only)
    ("table_layout", Role.OWNER, 200),
    ("table_layout", Role.BRANCH_MANAGER, 200),
    ("table_layout", Role.CASHIER, 403),
    ("table_layout", Role.WAITER, 403),
    ("table_layout", Role.KITCHEN, 403),
    ("table_layout", Role.INVENTORY_MANAGER, 403),
    # 7. Service area create -> area.manage (OWNER, BM only)
    ("area_create", Role.OWNER, 201),
    ("area_create", Role.BRANCH_MANAGER, 201),
    ("area_create", Role.CASHIER, 403),
    ("area_create", Role.WAITER, 403),
    ("area_create", Role.KITCHEN, 403),
    ("area_create", Role.INVENTORY_MANAGER, 403),
    # 8. QR Code generate -> qr.manage (OWNER, BM only)
    ("qr_generate", Role.OWNER, 201),
    ("qr_generate", Role.BRANCH_MANAGER, 201),
    ("qr_generate", Role.CASHIER, 403),
    ("qr_generate", Role.WAITER, 403),
    ("qr_generate", Role.KITCHEN, 403),
    ("qr_generate", Role.INVENTORY_MANAGER, 403),
    # 9. Staff assignment -> table.assign (OWNER, BM only)
    ("staff_assign", Role.OWNER, 201),
    ("staff_assign", Role.BRANCH_MANAGER, 201),
    ("staff_assign", Role.CASHIER, 403),
    ("staff_assign", Role.WAITER, 403),
    ("staff_assign", Role.KITCHEN, 403),
    ("staff_assign", Role.INVENTORY_MANAGER, 403),
    # 10. Onboarding status -> OWNER and BM only
    ("onboarding_status", Role.OWNER, 200),
    ("onboarding_status", Role.BRANCH_MANAGER, 200),
    ("onboarding_status", Role.CASHIER, 403),
    ("onboarding_status", Role.WAITER, 403),
    ("onboarding_status", Role.KITCHEN, 403),
    ("onboarding_status", Role.INVENTORY_MANAGER, 403),
    # 11. Branch create -> branch.manage (OWNER only)
    ("branch_create", Role.OWNER, 201),
    ("branch_create", Role.BRANCH_MANAGER, 403),
    ("branch_create", Role.CASHIER, 403),
    ("branch_create", Role.WAITER, 403),
    ("branch_create", Role.KITCHEN, 403),
    ("branch_create", Role.INVENTORY_MANAGER, 403),
    # 12. Business profile update -> business.manage (OWNER only)
    ("business_profile_patch", Role.OWNER, 200),
    ("business_profile_patch", Role.BRANCH_MANAGER, 403),
    ("business_profile_patch", Role.CASHIER, 403),
    ("business_profile_patch", Role.WAITER, 403),
    ("business_profile_patch", Role.KITCHEN, 403),
    ("business_profile_patch", Role.INVENTORY_MANAGER, 403),
]


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint,role,expected_status", MATRIX_TEST_CASES)
def test_role_x_endpoint_access(matrix_env, endpoint, role, expected_status):
    client = matrix_env["clients"][role]
    tenant = matrix_env["tenant"]
    branch = matrix_env["branch"]
    area = matrix_env["area"]
    sec = matrix_env["section"]

    if endpoint == "table_status_transition":
        table = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"T-Status-{role}", capacity=4, status=TableStatus.AVAILABLE
        )
        res = client.post(f"/api/v1/tables/{table.id}/status/", {"status": TableStatus.OCCUPIED})
        assert res.status_code == expected_status

    elif endpoint == "table_merge_join":
        t1 = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"TJ1-{role}", capacity=2, is_combinable=True
        )
        t2 = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"TJ2-{role}", capacity=2, is_combinable=True
        )
        res = client.post("/api/v1/tables/join/", {"table_ids": [str(t1.id), str(t2.id)]})
        assert res.status_code == expected_status

    elif endpoint == "table_session_open":
        table = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"T-Open-{role}", capacity=4, status=TableStatus.AVAILABLE
        )
        res = client.post("/api/v1/table-sessions/open/", {"table_id": str(table.id), "guest_count": 2})
        assert res.status_code == expected_status

    elif endpoint == "table_session_close":
        table = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"T-Close-{role}", capacity=4, status=TableStatus.OCCUPIED
        )
        session = TableSession.objects.create(
            tenant=tenant, branch=branch, table=table, session_code=f"S-{role[:4]}", guest_count=2
        )
        res = client.post(f"/api/v1/table-sessions/{session.id}/close/")
        assert res.status_code == expected_status

    elif endpoint == "table_create":
        res = client.post(
            "/api/v1/tables/",
            {
                "branch": str(branch.id),
                "section": str(sec.id),
                "label": f"T-New-{role}",
                "table_type": TableType.TABLE,
                "shape": TableShape.RECT,
                "capacity": 4,
            },
        )
        assert res.status_code == expected_status

    elif endpoint == "table_layout":
        table = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"T-Layout-{role}", capacity=4
        )
        res = client.post(
            "/api/v1/tables/layout/",
            {"tables": [{"id": str(table.id), "x": 100, "y": 200, "rotation": 0}]},
            format="json",
        )
        assert res.status_code == expected_status

    elif endpoint == "area_create":
        res = client.post(
            "/api/v1/service-areas/",
            {"branch": str(branch.id), "name": f"Area-{role}", "area_type": AreaType.DINING},
        )
        assert res.status_code == expected_status

    elif endpoint == "qr_generate":
        table = DiningTable.objects.create(
            tenant=tenant, branch=branch, section=sec, label=f"T-QR-{role}", capacity=4
        )
        res = client.post(
            "/api/v1/qr-codes/generate/",
            {"branch_id": str(branch.id), "table_id": str(table.id)},
        )
        assert res.status_code == expected_status

    elif endpoint == "staff_assign":
        from apps.venues.models import Section
        sec = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name=f"Sec-{role}")
        w_user = User.objects.create_user(email=f"wassign_{role.lower()}@test.com", password="P1!")
        w_mem = Membership.objects.create(user=w_user, tenant=tenant, role=Role.WAITER)
        res = client.post(
            "/api/v1/staff-assignments/",
            {"branch": str(branch.id), "section": str(sec.id), "membership": str(w_mem.id)},
        )
        assert res.status_code == expected_status

    elif endpoint == "onboarding_status":
        res = client.get("/api/v1/onboarding/status/")
        assert res.status_code == expected_status

    elif endpoint == "branch_create":
        res = client.post("/api/v1/branches/", {"name": f"Branch New {role}"})
        assert res.status_code == expected_status

    elif endpoint == "business_profile_patch":
        res = client.patch("/api/v1/business/", {"name": f"Renamed By {role}"})
        assert res.status_code == expected_status
