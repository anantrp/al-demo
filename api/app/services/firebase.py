import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_client import BaseClient

from app.config import settings

_app: firebase_admin.App | None = None


def init_firebase() -> None:
    global _app
    if _app is not None:
        return

    if settings.is_local:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    else:
        cred = credentials.ApplicationDefault()

    _app = firebase_admin.initialize_app(cred)


def get_db() -> BaseClient:
    if _app is None:
        init_firebase()
    return firestore.client()


def get_auth():
    if _app is None:
        init_firebase()
    return firebase_auth


def verify_id_token(id_token: str) -> dict:
    if _app is None:
        init_firebase()
    try:
        return firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise ValueError(f"Invalid token: {e}") from e
