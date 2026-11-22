from .base import *  # noqa: F403

DEBUG = True

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": "10000/minute",
    "user": "10000/minute",
    "login_ip": "10000/minute",
    "login_email": "10000/minute",
    "change_password": "10000/minute",
    "public_qr_ip": "10000/minute",
    "public_qr_token": "10000/minute",
    "public_order_track": "10000/minute",
}

PUBLIC_QR_ORDER_LIMITS = {  # noqa: F405
    **PUBLIC_QR_ORDER_LIMITS,  # noqa: F405
    "MAX_OPEN_QR_ORDERS_PER_SESSION": 15,
    "MAX_QR_ORDERS_PER_10_MIN": 50,
}

DATABASES["default"]["CONN_MAX_AGE"] = 60  # noqa: F405

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
    *PASSWORD_HASHERS,  # noqa: F405
]
