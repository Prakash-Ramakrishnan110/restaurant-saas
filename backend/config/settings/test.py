import environ

from .base import *  # noqa: F403

DEBUG = False
TESTING = True

env = environ.Env()

# Confirm tests and CI run on PostgreSQL (Prompt 2 requirement A1)
# Stated DB engine: django.db.backends.postgresql
DB_ENGINE = env.str("TEST_DB_ENGINE", default="django.db.backends.postgresql")

POSTGRES_HOST_PORT = env.int("POSTGRES_HOST_PORT", default=5435)

DATABASES = {
    "default": {
        "ENGINE": DB_ENGINE,
        "NAME": env.str("TEST_DB_NAME", default=env.str("DB_NAME", default="fusion_saas")),
        "USER": env.str("TEST_DB_USER", default=env.str("DB_USER", default="postgres")),
        "PASSWORD": env.str("TEST_DB_PASSWORD", default=env.str("DB_PASSWORD", default="postgres")),
        "HOST": env.str("TEST_DB_HOST", default=env.str("DB_HOST", default="127.0.0.1")),
        "PORT": env.int("TEST_DB_PORT", default=env.int("DB_PORT", default=POSTGRES_HOST_PORT)),
        "TEST": {
            "NAME": "fusion_saas_test",
        },
    }
}

# In-memory channel layers for testing
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# Eager Celery for tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Fast password hasher for test execution speed
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Throttling high limits during tests
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": "10000/minute",
    "user": "10000/minute",
    "login_ip": "10000/minute",
    "login_email": "10000/minute",
    "change_password": "10000/minute",
}
