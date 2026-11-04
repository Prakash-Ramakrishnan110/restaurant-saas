from typing import Any

from django.http import Http404
from rest_framework import exceptions

from apps.core.exceptions import custom_exception_handler


def test_custom_exception_handler():
    context: dict[str, Any] = {}

    # ValidationError
    val_exc = exceptions.ValidationError({"field": ["This field is required."]})
    res = custom_exception_handler(val_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "VALIDATION_ERROR"
    assert "field" in res.data["error"]["details"]

    # AuthenticationFailed
    auth_exc = exceptions.AuthenticationFailed("Invalid credentials.")
    res = custom_exception_handler(auth_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "AUTHENTICATION_FAILED"

    # PermissionDenied
    perm_exc = exceptions.PermissionDenied("Forbidden action.")
    res = custom_exception_handler(perm_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "PERMISSION_DENIED"

    # NotFound
    nf_exc = exceptions.NotFound("Item not found.")
    res = custom_exception_handler(nf_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "NOT_FOUND"

    # Http404
    http404_exc = Http404("Not found here.")
    res = custom_exception_handler(http404_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "NOT_FOUND"

    # PermissionDenied with PASSWORD_CHANGE_REQUIRED code
    pw_exc = exceptions.PermissionDenied(
        detail="You must change your temporary password before accessing this resource.",
        code="PASSWORD_CHANGE_REQUIRED",
    )
    res_pw = custom_exception_handler(pw_exc, context)
    assert res_pw is not None
    assert res_pw.data["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"

    # Throttled
    throttle_exc = exceptions.Throttled(wait=60)
    res = custom_exception_handler(throttle_exc, context)
    assert res is not None
    assert res.data["error"]["code"] == "RATE_LIMITED"
    assert res.data["error"]["details"]["wait_seconds"] == 60

    # Unhandled standard exception
    unhandled = RuntimeError("Unexpected")
    res = custom_exception_handler(unhandled, context)
    assert res is None


def test_all_business_error_codes_and_details():
    from apps.core.exceptions import BusinessRuleError
    from apps.subscriptions.services import EntitlementLimitReached

    context: dict[str, Any] = {}

    business_errors = [
        (
            EntitlementLimitReached(limit_key="max_tables", limit=10, current=10),
            "ENTITLEMENT_LIMIT_REACHED",
            403,
            {"limit_key": "max_tables", "limit": 10, "current": 10},
        ),
        (
            BusinessRuleError(
                "LAST_OWNER",
                "This is the only active owner. Make someone else an owner first.",
                status_code=409,
                details={"membership_id": "mem-1"},
            ),
            "LAST_OWNER",
            409,
            {"membership_id": "mem-1"},
        ),
        (
            BusinessRuleError(
                "ROLE_NOT_ALLOWED",
                "BRANCH_MANAGER cannot assign or manage OWNER role.",
                status_code=403,
                details={"target_role": "OWNER"},
            ),
            "ROLE_NOT_ALLOWED",
            403,
            {"target_role": "OWNER"},
        ),
        (
            BusinessRuleError(
                "INVALID_STATUS_TRANSITION",
                "Cannot change table status from 'OCCUPIED' to 'AVAILABLE'.",
                status_code=400,
                details={"from": "OCCUPIED", "to": "AVAILABLE", "allowed": ["CLEANING"]},
            ),
            "INVALID_STATUS_TRANSITION",
            400,
            {"from": "OCCUPIED", "to": "AVAILABLE", "allowed": ["CLEANING"]},
        ),
        (
            BusinessRuleError(
                "TABLES_NOT_COMBINABLE",
                "At least two tables are required to form a table group.",
                status_code=400,
                details={"table_ids": ["tbl-1"]},
            ),
            "TABLES_NOT_COMBINABLE",
            400,
            {"table_ids": ["tbl-1"]},
        ),
        (
            BusinessRuleError(
                "TABLE_NOT_AVAILABLE",
                "Table 'T1' is occupied and cannot be seated right now.",
                status_code=409,
                details={"table_id": "tbl-1", "status": "OCCUPIED"},
            ),
            "TABLE_NOT_AVAILABLE",
            409,
            {"table_id": "tbl-1", "status": "OCCUPIED"},
        ),
        (
            BusinessRuleError(
                "SESSION_ALREADY_OPEN",
                "An active session is already open on this table.",
                status_code=409,
                details={"table_id": "tbl-1"},
            ),
            "SESSION_ALREADY_OPEN",
            409,
            {"table_id": "tbl-1"},
        ),
        (
            BusinessRuleError(
                "DUPLICATE_LABEL",
                "A table labelled 'T1' already exists in this branch.",
                status_code=409,
                details={"label": "T1"},
            ),
            "DUPLICATE_LABEL",
            409,
            {"label": "T1"},
        ),
    ]

    assert len(business_errors) == 8

    for exc, expected_code, expected_status, expected_details in business_errors:
        res = custom_exception_handler(exc, context)
        assert res is not None
        assert res.status_code == expected_status
        assert res.data["error"]["code"] == expected_code
        assert res.data["error"]["details"] == expected_details
        assert len(res.data["error"]["message"]) > 0

