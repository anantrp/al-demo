import json

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore, storage

from app.config import settings

_initialized = False


def _get_project_id() -> str:
    if settings.FIREBASE_PROJECT_ID:
        return settings.FIREBASE_PROJECT_ID
    if settings.is_cloud:
        return ""
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
    options: dict = {"storageBucket": settings.FIREBASE_STORAGE_BUCKET}
    if project_id:
        options["projectId"] = project_id
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

    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiry_minutes),
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
