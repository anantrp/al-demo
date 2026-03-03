from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.firebase import verify_id_token

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to verify Firebase ID token and return user information.

    This can be used as a dependency in any route to automatically authenticate requests.

    Usage:
        @router.get("/protected")
        async def protected_route(user: Dict = Depends(get_current_user)):
            return {"user_id": user["uid"]}

    Args:
        credentials: HTTP Bearer token credentials from Authorization header

    Returns:
        dict: Decoded token containing user information (uid, email, etc.)

    Raises:
        HTTPException: 401 if token is invalid or missing
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to continue",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = verify_id_token(credentials.credentials)
        return decoded_token
    except ValueError as e:
        print(f"[get_current_user] Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"[get_current_user] Unexpected auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error. Please try again",
        )
