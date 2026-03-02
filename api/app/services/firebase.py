from datetime import timedelta

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore, storage
from google.cloud.firestore_v1.base_client import BaseClient
from google.cloud.storage import Bucket

from app.config import settings

_app: firebase_admin.App | None = None


def init_firebase() -> None:
    global _app
    if _app is not None:
        return

    try:
        if settings.is_local:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        else:
            cred = credentials.ApplicationDefault()

        _app = firebase_admin.initialize_app(
            cred,
            {
                "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
            },
        )

    except Exception:
        raise


def get_db() -> BaseClient:
    if _app is None:
        init_firebase()
    return firestore.client()


def get_auth():
    if _app is None:
        init_firebase()
    return firebase_auth


def get_storage_bucket() -> Bucket:
    if _app is None:
        init_firebase()
    return storage.bucket()


def get_signed_read_url(storage_path: str, expiry_minutes: int = 15) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)

    try:
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="GET",
        )
        return url
    except Exception as e:
        if "does not have permission to sign" in str(e) or "SSL" in str(e):
            raise RuntimeError(
                "Service account lacks self-signing permission. "
                "Grant roles/iam.serviceAccountTokenCreator to the service account on itself:\n"
                "gcloud iam service-accounts add-iam-policy-binding YOUR_SA@PROJECT.iam.gserviceaccount.com "
                "--member='serviceAccount:YOUR_SA@PROJECT.iam.gserviceaccount.com' "
                "--role='roles/iam.serviceAccountTokenCreator'"
            ) from e
        raise


def get_signed_upload_url(
    storage_path: str,
    content_type: str = "application/octet-stream",
    expiry_minutes: int = 5,
) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)

    try:
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="PUT",
            content_type=content_type,
        )
        return url
    except Exception as e:
        if "does not have permission to sign" in str(e) or "SSL" in str(e):
            raise RuntimeError(
                "Service account lacks self-signing permission. "
                "See get_signed_read_url() error message for fix."
            ) from e
        raise


def verify_id_token(id_token: str) -> dict:
    if _app is None:
        init_firebase()
    try:
        return firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise ValueError(f"Invalid token: {e}") from e


def upload_file(storage_path: str, file_content: bytes, content_type: str) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    blob.upload_from_string(file_content, content_type=content_type)
    return storage_path


def delete_file(storage_path: str) -> None:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    blob.delete()


def file_exists(storage_path: str) -> bool:
    bucket = get_storage_bucket()
    blob = bucket.blob(storage_path)
    return blob.exists()
