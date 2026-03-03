from fastapi import APIRouter, Depends, HTTPException, status

from app.routes.deps.worker_auth import verify_worker_api_key
from app.services.extraction_service import run_extraction

router = APIRouter(prefix="/worker", tags=["worker"])


@router.post("/extraction/{extraction_id}")
async def process_extraction(
    extraction_id: str,
    _: None = Depends(verify_worker_api_key),
):
    try:
        run_extraction(extraction_id)
        return {"status": "success", "extraction_id": extraction_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {e!s}",
        )
