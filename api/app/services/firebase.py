import json
from datetime import timedelta

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore, storage

from app.config import settings

_app: firebase_admin.App | None = None
_cloud_credentials = None


def _get_cloud_credentials():
    """Return refreshed ADC credentials, cached across calls."""
    global _cloud_credentials
    if _cloud_credentials is None:
        import google.auth

        _cloud_credentials, _ = google.auth.default()

    if not _cloud_credentials.valid:
        from google.auth.transport.requests import Request

        _cloud_credentials.refresh(Request())

    return _cloud_credentials


def _resolve_project_id() -> str:
    if settings.is_local:
        with open(settings.FIREBASE_SERVICE_ACCOUNT_PATH) as f:
            return json.load(f).get("project_id", "")
    creds = _get_cloud_credentials()
    return creds.project_id or getattr(creds, "project", "") or ""


def init_firebase():
    global _app
    if _app is not None:
        return

    if not settings.FIREBASE_STORAGE_BUCKET:
        raise ValueError("FIREBASE_STORAGE_BUCKET is required. Set it in your .env file.")

    if settings.is_local:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    else:
        cred = credentials.ApplicationDefault()

    project_id = _resolve_project_id()
    if not project_id:
        raise ValueError(
            "Could not determine GCP project ID. "
            "Local: ensure service account JSON has project_id. "
            "Cloud: ensure GOOGLE_CLOUD_PROJECT is set (automatic on Cloud Run)."
        )

    _app = firebase_admin.initialize_app(
        cred,
        {
            "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
            "projectId": project_id,
        },
    )


def get_db():
    if _app is None:
        init_firebase()
    return firestore.client()


def get_auth():
    if _app is None:
        init_firebase()
    return firebase_auth


def get_storage_bucket():
    if _app is None:
        init_firebase()
    return storage.bucket()


def get_signed_read_url(storage_path: str, expiry_minutes: int = 15) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    expiration = timedelta(minutes=expiry_minutes)

    if settings.is_local:
        return blob.generate_signed_url(
            version="v4",
            expiration=expiration,
            method="GET",
        )

    creds = _get_cloud_credentials()
    return blob.generate_signed_url(
        version="v4",
        expiration=expiration,
        method="GET",
        service_account_email=creds.service_account_email,
        access_token=creds.token,
    )


def verify_id_token(id_token: str):
    if _app is None:
        init_firebase()
    try:
        return firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise ValueError(f"Invalid token: {e!s}") from e
