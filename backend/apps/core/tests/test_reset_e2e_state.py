import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings


@pytest.mark.django_db
def test_reset_e2e_state_requires_debug_or_test(monkeypatch):
    monkeypatch.delenv("TEST", raising=False)
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.prod")
    with (
        override_settings(DEBUG=False, TESTING=False),
        pytest.raises(CommandError, match="DEBUG or TEST"),
    ):
        call_command("reset_e2e_state")


@pytest.mark.django_db
def test_reset_e2e_state_runs_when_debug_true():
    with override_settings(DEBUG=True):
        call_command("reset_e2e_state")
