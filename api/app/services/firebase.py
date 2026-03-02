import json

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore, storage

from app.config import settings

_initialized = False


def _get_project_id() -> str:
    if settings.is_cloud:
        import google.auth

        _, project_id = google.auth.default()
        return project_id or ""
    with open(settings.FIREBASE_SERVICE_ACCOUNT_PATH) as f:
        data = json.load(f)
    return data.get("project_id", "")


def init_firebase():
    global _initialized
    if _initialized:
        return

    if settings.is_cloud:
        cred = credentials.ApplicationDefault()
    else:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)

    if not settings.FIREBASE_STORAGE_BUCKET:
        raise ValueError("FIREBASE_STORAGE_BUCKET is required. Set it in your .env file.")

    project_id = _get_project_id()
    if not project_id:
        raise ValueError(
            "Project ID is required. Local: ensure service account JSON has project_id. "
            "Cloud: ensure GOOGLE_CLOUD_PROJECT is set (automatic on Cloud Run)."
        )
    options: dict = {
        "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
        "projectId": project_id,
    }
    firebase_admin.initialize_app(cred, options)
    _initialized = True


def get_db():
    if not _initialized:
        init_firebase()
    return firestore.client()


def get_auth():
    if not _initialized:
        init_firebase()
    return firebase_auth


def get_storage_bucket():
    if not _initialized:
        init_firebase()
    return storage.bucket()


def get_signed_read_url(storage_path: str, expiry_minutes: int = 15) -> str:
    from datetime import timedelta

    import google.auth
    from google.auth.transport import requests as auth_requests

    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    expiration = timedelta(minutes=expiry_minutes)

    if settings.is_cloud:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/iam"])
        creds.refresh(auth_requests.Request())
        return blob.generate_signed_url(
            version="v4",
            expiration=expiration,
            method="GET",
            service_account_email=creds.service_account_email,
            access_token=creds.token,
        )

    return blob.generate_signed_url(
        version="v4",
        expiration=expiration,
        method="GET",
    )


def verify_id_token(id_token: str):
    """
    Verify Firebase ID token and return decoded token with user info.

    Args:
        id_token: The Firebase ID token from the client

    Returns:
        dict: Decoded token containing user information

    Raises:
        ValueError: If token is invalid
    """
    if not _initialized:
        init_firebase()
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid token: {e!s}") from e
