import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore

from app.config import settings

_initialized = False


def init_firebase():
    global _initialized
    if _initialized:
        return

    if settings.is_cloud:
        # Cloud Run: Use default service account
        cred = credentials.ApplicationDefault()
    else:
        # Local: Use JSON file
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)

    firebase_admin.initialize_app(cred)
    _initialized = True


def get_db():
    if not _initialized:
        init_firebase()
    return firestore.client()


def get_auth():
    if not _initialized:
        init_firebase()
    return firebase_auth


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
