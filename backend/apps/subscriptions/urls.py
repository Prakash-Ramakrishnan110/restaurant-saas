from django.urls import path

from apps.subscriptions.views import EntitlementsView, PlanListView

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plans-list"),
    path("entitlements/", EntitlementsView.as_view(), name="entitlements-summary"),
]
