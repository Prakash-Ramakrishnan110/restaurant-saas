from typing import Any

from django.http import Http404
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
        code = "RATE_LIMIT_EXCEEDED"
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
