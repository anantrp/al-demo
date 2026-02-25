from fastapi import APIRouter, Depends

from app.routes.deps.user_auth import get_current_user

router = APIRouter(tags=["user"])


@router.get("/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """
    Get current user info from Firebase ID token.

    Expects Authorization header in format: "Bearer <id_token>"
    Route is automatically authenticated via the get_current_user dependency.
    """
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "email_verified": user.get("email_verified"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "auth_time": user.get("auth_time"),
    }
