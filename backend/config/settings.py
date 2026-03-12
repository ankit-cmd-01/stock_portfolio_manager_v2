import os
from importlib.util import find_spec
from pathlib import Path

if find_spec("dj_database_url") is not None:
    import dj_database_url
else:  # pragma: no cover - local fallback before requirements are installed
    dj_database_url = None

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
HAS_CORSHEADERS = find_spec("corsheaders") is not None
HAS_WHITENOISE = find_spec("whitenoise") is not None


def _env_bool(name, default=False):
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name, default=None):
    raw_value = os.getenv(name, "")
    if not raw_value:
        return list(default or [])
    return [item.strip() for item in raw_value.split(",") if item.strip()]


SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "change-me-before-production",
)
DEBUG = _env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "testserver"])
CSRF_TRUSTED_ORIGINS = _env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = _env_list("DJANGO_CORS_ALLOWED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = _env_bool("DJANGO_CORS_ALLOW_ALL", False)


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'portfolio',
]
if HAS_CORSHEADERS:
    INSTALLED_APPS.append('corsheaders')

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
if HAS_WHITENOISE:
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
if HAS_CORSHEADERS:
    MIDDLEWARE.insert(2 if HAS_WHITENOISE else 1, 'corsheaders.middleware.CorsMiddleware')

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

database_url = os.getenv("DATABASE_URL", "").strip()
if database_url and dj_database_url is not None:
    DATABASES["default"] = dj_database_url.parse(database_url, conn_max_age=600, ssl_require=False)


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

if HAS_WHITENOISE:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", False)
SESSION_COOKIE_SECURE = _env_bool("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = _env_bool("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
SECURE_HSTS_PRELOAD = _env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
