"""
Enqueue extraction route.

TODO: Replace background job with Cloud Task/worker implementation per ARCHITECTURE.md and USER_FLOWS.md.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.routes.deps.user_auth import get_current_user
from app.services.enqueue_service import enqueue_extraction
from app.services.firebase import get_db

router = APIRouter(prefix="/enqueue", tags=["enqueue"])


@router.post("/extraction")
async def post_enqueue_extraction(
    body: dict,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """
    Enqueue an extraction job for a case's source document.

    Verifies ID token and case ownership. Creates extraction doc and runs extraction
    via background task. In the future this will be replaced with Cloud Task.
    """
    case_id = body.get("caseId")
    source_document_id = body.get("sourceDocumentId")

    if not case_id or not source_document_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="caseId and sourceDocumentId are required",
        )

    db = get_db()
    case_ref = db.collection("cases").document(case_id)
    case_doc = case_ref.get()

    if not case_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    case_data = case_doc.to_dict()
    if case_data.get("userId") != user.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this case",
        )

    result = enqueue_extraction(
        db=db,
        case_id=case_id,
        source_document_id=source_document_id,
        user_id=user["uid"],
        background_tasks=background_tasks,
    )
    return {"extractionId": result["extraction_id"]}
