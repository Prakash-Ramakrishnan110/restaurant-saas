from django.urls import path

from apps.subscriptions.views import EntitlementsView, PlanDetailView, PlanListView

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plans-list"),
    path("plans/<uuid:pk>/", PlanDetailView.as_view(), name="plan-detail"),
    path("entitlements/", EntitlementsView.as_view(), name="entitlements-summary"),
]
