from datetime import timedelta
from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Read .env file from root or backend if present
environ.Env.read_env(BASE_DIR.parent / ".env")
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env.str(
    "SECRET_KEY", default="django-insecure-default-dev-key-change-in-production-1234567890"
)
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "0.0.0.0"])

# Application definition
DJANGO_APPS = [
    "daphne",  # ASGI / Channels server integration must precede django.contrib.staticfiles
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "channels",
]

LOCAL_APPS = [
    "apps.core",
    "apps.tenants",
    "apps.accounts",
    "apps.rbac",
    "apps.audit",
    "apps.subscriptions",
    "apps.venues",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.TenantContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# Password hashing using Argon2 as primary
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Database configuration
POSTGRES_HOST_PORT = env.int("POSTGRES_HOST_PORT", default=5435)
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"postgres://{env.str('DB_USER', 'postgres')}:{env.str('DB_PASSWORD', 'postgres')}@{env.str('DB_HOST', '127.0.0.1')}:{env.int('DB_PORT', POSTGRES_HOST_PORT)}/{env.str('DB_NAME', 'fusion_saas')}",
    )
}

# Redis & Channels Layer
REDIS_URL = env.str("REDIS_URL", default="redis://localhost:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

# Celery settings
CELERY_BROKER_URL = env.str("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env.str("CELERY_RESULT_BACKEND", default="redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = env.str("DEFAULT_TIMEZONE", default="Asia/Kolkata")
CELERY_BEAT_SCHEDULE = {
    "expire-idle-sessions-every-30-minutes": {
        "task": "apps.core.tasks.expire_idle_sessions_task",
        "schedule": 1800.0,
    },
}

# CORS & CSRF
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = env.str("DEFAULT_TIMEZONE", default="Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
PUBLIC_MENU_BASE_URL = env("PUBLIC_MENU_BASE_URL", default="http://localhost:5173/q")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/minute",
        "user": "1000/minute",
        "login_ip": "10/minute",
        "login_email": "5/minute",
        "change_password": "5/minute",
    },
}

# SimpleJWT settings
ACCESS_TOKEN_LIFETIME = timedelta(minutes=env.int("ACCESS_TOKEN_LIFETIME_MINUTES", default=15))
REFRESH_TOKEN_LIFETIME = timedelta(days=env.int("REFRESH_TOKEN_LIFETIME_DAYS", default=7))
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": ACCESS_TOKEN_LIFETIME,
    "REFRESH_TOKEN_LIFETIME": REFRESH_TOKEN_LIFETIME,
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env.str("JWT_SIGNING_KEY", default=SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Cookie Settings for Refresh Token
REFRESH_COOKIE_NAME = "refresh_token"
COOKIE_SECURE = env.bool("COOKIE_SECURE", default=False)
COOKIE_SAMESITE = env.str("COOKIE_SAMESITE", default="Lax")
COOKIE_PATH = "/api/v1/auth/"

# Frontend URL for QR codes and client links
FRONTEND_URL = env.str("FRONTEND_URL", default="http://localhost:3000")

# drf-spectacular settings
SPECTACULAR_SETTINGS = {
    "TITLE": "Fusion Engine Restaurant SaaS API",
    "DESCRIPTION": "Multi-tenant Restaurant Management SaaS backend foundation API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v[0-9]+",
    "ENUM_NAME_OVERRIDES": {
        "TenantStatus": "apps.tenants.models.Tenant.Status",
        "BusinessType": "apps.tenants.models.Tenant.BusinessType",
        "TaxMode": "apps.tenants.models.BusinessSettings.TaxMode",
        "VenueProfile": "apps.tenants.models.Branch.VenueProfile",
        "MembershipRole": "apps.rbac.constants.Role.CHOICES",
        "SubscriptionStatus": "apps.subscriptions.models.SubscriptionStatus",
        "TableStatus": "apps.venues.constants.TableStatus",
        "SessionStatus": "apps.venues.constants.SessionStatus",
        "OpenedVia": "apps.venues.constants.OpenedVia",
        "AreaType": "apps.venues.constants.AreaType",
        "TableType": "apps.venues.constants.TableType",
        "TableShape": "apps.venues.constants.TableShape",
        "PaymentTiming": "apps.venues.constants.PaymentTiming",
        "QrOrderingMode": "apps.venues.constants.QROrderingMode",
        "QrSessionPolicy": "apps.venues.constants.QRSessionPolicy",
        "QRTargetType": "apps.venues.constants.QRTargetType",
        "OrderWorkflow": "apps.venues.constants.OrderWorkflow",
    },
}
