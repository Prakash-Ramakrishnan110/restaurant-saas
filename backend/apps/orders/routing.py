from django.urls import path

from apps.orders.consumers import BranchStreamConsumer

websocket_urlpatterns = [
    path("ws/v1/branch/<uuid:branch_id>/stream/", BranchStreamConsumer.as_asgi()),
]
