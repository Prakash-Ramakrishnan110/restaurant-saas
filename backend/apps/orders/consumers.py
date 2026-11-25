from __future__ import annotations

import urllib.parse
from typing import Any, cast

from asgiref.sync import async_to_sync, sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import Membership, User
from apps.core.context import reset_current_tenant, set_current_tenant
from apps.tenants.models import Branch

CANONICAL_STREAM_EVENTS = {
    "order.created",
    "order.status_changed",
    "order.token_called",
    "table.updated",
    "menu.availability_changed",
    "stock.alert",
}


def _authenticate_branch_stream_sync(token_str: str, branch_id: str) -> tuple[int, str | None]:
    """
    Validates JWT access token and verifies tenant/branch access.
    Returns (status_code, group_name).
    status_code: 200 (OK), 4401 (Unauthenticated), 4403 (Forbidden / Cross-Tenant).
    """
    if not token_str:
        return 4401, None

    try:
        access = AccessToken(cast(Any, token_str))
        user_id = access.get("user_id")
        if not user_id:
            return 4401, None
        user = User.objects.filter(id=user_id, is_active=True).first()
        if user is None:
            return 4401, None
    except Exception:
        return 4401, None

    branch = None
    membership = None
    for candidate_membership in Membership.objects.filter(
        user=user,
        is_active=True,
    ).select_related("tenant"):
        token = set_current_tenant(candidate_membership.tenant)
        try:
            found_branch = Branch.objects.filter(id=branch_id, is_active=True).first()
            if found_branch is not None:
                branch = found_branch
                membership = candidate_membership
                break
        finally:
            reset_current_tenant(token)

    if branch is None or membership is None:
        return 4403, None

    if (
        membership.role != "OWNER"
        and membership.branches.exists()
        and not membership.branches.filter(id=branch.id).exists()
    ):
        return 4403, None

    group_name = f"branch_{branch.tenant_id}_{branch.id}"
    return 200, group_name


_authenticate_branch_stream = sync_to_async(_authenticate_branch_stream_sync)


class BranchStreamConsumer(AsyncJsonWebsocketConsumer):
    """Tenant & branch-scoped real-time operational stream consumer."""

    group_name: str | None = None

    async def connect(self) -> None:
        url_route = self.scope.get("url_route", {})
        kwargs = url_route.get("kwargs", {})
        branch_id = str(kwargs.get("branch_id", ""))

        raw_qs = self.scope.get("query_string", b"").decode("utf-8", errors="ignore")
        params = urllib.parse.parse_qs(raw_qs)
        token_list = params.get("token") or []
        token_str = token_list[0] if token_list else ""

        if not token_str:
            headers = dict(self.scope.get("headers") or [])
            auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")
            if auth_header.lower().startswith("bearer "):
                token_str = auth_header[7:].strip()

        code, group_name = await _authenticate_branch_stream(token_str, branch_id)
        if code != 200 or not group_name:
            await self.accept()
            await self.close(code=code)
            return

        self.group_name = group_name
        if self.channel_layer is not None:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "type": "connected",
                "branch_id": branch_id,
                "ts": timezone.now().isoformat(),
            }
        )

    async def disconnect(self, close_code: int) -> None:
        if self.group_name and self.channel_layer is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs: Any) -> None:
        msg_type = content.get("type")
        if msg_type == "ping":
            await self.send_json({"type": "pong", "ts": timezone.now().isoformat()})

    async def branch_event(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {
                "type": event.get("event_type", "update"),
                "payload": event.get("payload", {}),
                "ts": event.get("ts", timezone.now().isoformat()),
            }
        )


def broadcast_branch_event(
    tenant_id: Any,
    branch_id: Any,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    """Broadcasts one of the 5 canonical branch events over Django Channels."""
    if event_type not in CANONICAL_STREAM_EVENTS:
        return
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        group_name = f"branch_{tenant_id}_{branch_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "branch.event",
                "event_type": event_type,
                "payload": payload,
                "ts": timezone.now().isoformat(),
            },
        )
    except Exception:
        # Never block transactional HTTP writes if Redis channel layer is unavailable
        pass
