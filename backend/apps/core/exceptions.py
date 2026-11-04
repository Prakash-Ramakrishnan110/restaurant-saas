from typing import Any

from django.http import Http404
from rest_framework import serializers
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

# Ensure PrimaryKeyRelatedField does not leak object existence details
serializers.PrimaryKeyRelatedField.default_error_messages["does_not_exist"] = (
    "Invalid reference - object does not exist."
)


def _extract_codes(codes_obj: Any) -> list[str]:
    extracted: list[str] = []
    if isinstance(codes_obj, str):
        extracted.append(codes_obj)
    elif isinstance(codes_obj, list):
        for item in codes_obj:
            extracted.extend(_extract_codes(item))
    elif isinstance(codes_obj, dict):
        for item in codes_obj.values():
            extracted.extend(_extract_codes(item))
    return extracted


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Standardizes all DRF error responses to the uniform schema:

    {
        "error": {
            "code": "ERROR_CODE",
            "message": "Human readable message",
            "details": {...}
        }
    }
    """
    response = exception_handler(exc, context)

    if response is None:
        return None

    code = "API_ERROR"
    message = "An error occurred."
    details: Any = {}

    if isinstance(exc, ValidationError):
        raw_codes = _extract_codes(exc.get_codes()) if hasattr(exc, "get_codes") else []
        codes = [c.upper() for c in raw_codes]
        if "INVALID_CAPABILITY_COMBINATION" in codes:
            code = "INVALID_CAPABILITY_COMBINATION"
            message = "Invalid capability combination."
        elif any(c in ("DOES_NOT_EXIST", "INVALID_REFERENCE") for c in codes):
            code = "INVALID_REFERENCE"
            message = "Referenced entity does not exist."
        elif getattr(exc, "default_code", "invalid").lower() != "invalid":
            code = exc.default_code.upper()
            message = "Input validation failed."
        else:
            code = "VALIDATION_ERROR"
            message = "Input validation failed."
        details = exc.detail
    elif isinstance(exc, NotAuthenticated | AuthenticationFailed):
        code = "AUTHENTICATION_FAILED"
        message = getattr(
            exc, "detail", "Authentication credentials were not provided or are invalid."
        )
        if isinstance(message, dict):
            details = message
            message = "Authentication failed."
    elif isinstance(exc, PermissionDenied):
        raw_codes = _extract_codes(exc.get_codes()) if hasattr(exc, "get_codes") else []
        codes = [c.upper() for c in raw_codes]
        if "PASSWORD_CHANGE_REQUIRED" in codes:
            code = "PASSWORD_CHANGE_REQUIRED"
        else:
            code = "PERMISSION_DENIED"
        message = getattr(exc, "detail", "You do not have permission to perform this action.")
        if isinstance(message, dict):
            details = message
            message = "Permission denied."
    elif isinstance(exc, NotFound | Http404):
        code = "NOT_FOUND"
        message = getattr(exc, "detail", "The requested resource was not found.")
        if isinstance(message, dict):
            details = message
            message = "Resource not found."
    elif isinstance(exc, Throttled):
        code = "RATE_LIMITED"
        wait_sec = getattr(exc, "wait", None)
        message = f"Request was throttled. Expected available in {wait_sec} seconds."
        details = {"wait_seconds": wait_sec}
    elif isinstance(exc, APIException):
        code = getattr(exc, "default_code", "API_ERROR").upper()
        if hasattr(exc, "detail"):
            if isinstance(exc.detail, str):
                message = exc.detail
            elif isinstance(exc.detail, dict):
                details = exc.detail
                message = "An API error occurred."
            elif isinstance(exc.detail, list):
                details = {"errors": exc.detail}
                message = "An API error occurred."

    response.data = {
        "error": {
            "code": code,
            "message": str(message),
            "details": details,
        }
    }
    return response
