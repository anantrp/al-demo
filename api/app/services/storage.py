from datetime import timedelta
import os

from google.cloud import storage as gcs_storage

from app.config import settings

_gcs_client: gcs_storage.Client | None = None
_service_account_email: str | None = None


def _get_service_account_email() -> str:
    global _service_account_email

    if _service_account_email is not None:
        return _service_account_email

    if settings.is_local:
        import json

        with open(settings.FIREBASE_SERVICE_ACCOUNT_PATH) as f:
            sa_data = json.load(f)
            _service_account_email = sa_data.get("client_email")
    else:
        _service_account_email = os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")

        if not _service_account_email:
            try:
                import requests

                response = requests.get(
                    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email",
                    headers={"Metadata-Flavor": "Google"},
                    timeout=5,
                )
                _service_account_email = response.text
            except Exception as e:
                raise RuntimeError(f"Could not determine service account email: {e}")

    if not _service_account_email:
        raise RuntimeError("Service account email could not be determined")

    return _service_account_email


def _get_gcs_client() -> gcs_storage.Client:
    global _gcs_client

    if _gcs_client is not None:
        return _gcs_client

    if settings.is_local:
        _gcs_client = gcs_storage.Client.from_service_account_json(
            settings.FIREBASE_SERVICE_ACCOUNT_PATH
        )
    else:
        _gcs_client = gcs_storage.Client()

    return _gcs_client


def get_signed_read_url(storage_path: str, expiry_minutes: int = 15) -> str:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)

    if settings.is_local:
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="GET",
        )
    else:
        sa_email = _get_service_account_email()

        import google.auth
        import google.auth.transport.requests

        creds, _ = google.auth.default()

        if not creds.valid:
            auth_request = google.auth.transport.requests.Request()
            creds.refresh(auth_request)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="GET",
            service_account_email=sa_email,
            access_token=creds.token,
        )

    return url


def get_signed_upload_url(
    storage_path: str,
    content_type: str = "application/octet-stream",
    expiry_minutes: int = 5,
) -> str:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)

    if settings.is_local:
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="PUT",
            content_type=content_type,
        )
    else:
        sa_email = _get_service_account_email()

        import google.auth
        import google.auth.transport.requests

        creds, _ = google.auth.default()

        if not creds.valid:
            auth_request = google.auth.transport.requests.Request()
            creds.refresh(auth_request)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="PUT",
            content_type=content_type,
            service_account_email=sa_email,
            access_token=creds.token,
        )

    return url


def upload_file(storage_path: str, file_content: bytes, content_type: str) -> str:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    blob.upload_from_string(file_content, content_type=content_type)
    return storage_path


def delete_file(storage_path: str) -> None:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    blob.delete()


def file_exists(storage_path: str) -> bool:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    return blob.exists()


def download_file(storage_path: str) -> bytes:
    client = _get_gcs_client()
    bucket = client.bucket(settings.FIREBASE_STORAGE_BUCKET)
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()
