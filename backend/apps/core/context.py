from contextvars import ContextVar, Token
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from apps.tenants.models import Tenant

_current_tenant: ContextVar[Optional["Tenant"]] = ContextVar("current_tenant", default=None)


def get_current_tenant() -> Optional["Tenant"]:
    """Retrieve the active tenant for the current request/async context."""
    return _current_tenant.get()


def set_current_tenant(tenant: Optional["Tenant"]) -> Token[Optional["Tenant"]]:
    """Set the active tenant context.

    Returns a Token that can be used to reset the context.
    """
    return _current_tenant.set(tenant)


def reset_current_tenant(token: Token[Any]) -> None:
    """Reset the tenant context back to its previous value using the provided Token."""
    _current_tenant.reset(token)
