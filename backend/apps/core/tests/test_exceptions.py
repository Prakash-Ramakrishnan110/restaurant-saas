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
