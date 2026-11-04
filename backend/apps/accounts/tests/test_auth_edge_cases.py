import pytest
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import User
from apps.accounts.services import authenticate_and_login_user, logout_user


@pytest.mark.django_db
def test_login_user_without_memberships():
    User.objects.create_user(
        email="nomembership@example.com",
        password="ValidPassword123!",
        full_name="No Membership",
        is_active=True,
    )
    with pytest.raises(AuthenticationFailed):
        authenticate_and_login_user("nomembership@example.com", "ValidPassword123!")


@pytest.mark.django_db
def test_logout_with_invalid_token():
    logout_user("invalid-token-string", user=None)
    logout_user(None, user=None)
