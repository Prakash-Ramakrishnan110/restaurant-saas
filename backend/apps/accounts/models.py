from typing import Any

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel


class UserManager(BaseUserManager["User"]):
    """Custom manager for User model where email is the unique identifier."""

    def create_user(self, email: str, password: str | None = None, **extra_fields: Any) -> "User":
        if not email:
            raise ValueError("The Email field must be set.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email: str, password: str | None = None, **extra_fields: Any
    ) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_platform_admin", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        if extra_fields.get("is_platform_admin") is not True:
            raise ValueError("Superuser must have is_platform_admin=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, UUIDModel, TimeStampedModel):
    """Custom user entity supporting platform administrators and restaurant staff."""

    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_platform_admin = models.BooleanField(default=False, db_index=True)
    must_change_password = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["email"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return f"{self.email} ({self.full_name})"


class Membership(UUIDModel, TimeStampedModel):
    """Links a User to a Tenant with a specific Role and optional branch restrictions.

    An empty branches relation signifies tenant-wide access across all branches.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memberships",
        db_index=True,
    )
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.PROTECT,
        related_name="memberships",
        db_index=True,
    )
    role = models.CharField(max_length=32, db_index=True)
    branches = models.ManyToManyField(
        "tenants.Branch",
        blank=True,
        related_name="memberships",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "tenant"],
                name="unique_user_tenant_membership",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "user", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} -> {self.tenant.name} [{self.role}]"
