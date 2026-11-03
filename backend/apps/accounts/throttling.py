from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView


class LoginIPRateThrottle(SimpleRateThrottle):
    """Throttles login attempts based on client IP address."""

    scope = "login_ip"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        ip = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ip}


class LoginEmailRateThrottle(SimpleRateThrottle):
    """Throttles login attempts based on the submitted email address."""

    scope = "login_email"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        email = request.data.get("email")
        if not email:
            return None
        normalized_email = str(email).strip().lower()
        return self.cache_format % {"scope": self.scope, "ident": normalized_email}
