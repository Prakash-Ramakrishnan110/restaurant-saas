from django.urls import path

from apps.subscriptions.views import EntitlementsView

urlpatterns = [
    path("entitlements/", EntitlementsView.as_view(), name="entitlements-summary"),
]
