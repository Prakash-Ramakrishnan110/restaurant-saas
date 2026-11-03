from django.db import models


class SubscriptionStatus(models.TextChoices):
    TRIAL = "TRIAL", "Trial"
    ACTIVE = "ACTIVE", "Active"
    EXPIRING = "EXPIRING", "Expiring"
    GRACE = "GRACE", "Grace Period"
    EXPIRED = "EXPIRED", "Expired"
    SUSPENDED = "SUSPENDED", "Suspended"


# Statuses in which tenant operations are permitted
ALLOWED_SUBSCRIPTION_STATUSES = {
    SubscriptionStatus.TRIAL,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.EXPIRING,
    SubscriptionStatus.GRACE,
}
