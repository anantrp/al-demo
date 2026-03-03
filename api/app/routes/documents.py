import io
import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.routes.deps.user_auth import get_current_user
from app.services.firebase import get_db
from app.services.generation_service import (
    UserFacingError,
    aggregate_fields,
    prepare_template_context,
    render_document,
    validate_template,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/{case_id}/{template_id}/download")
async def download_document(
    case_id: str,
    template_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Generate and download a document on-the-fly.

    Verifies ID token and case ownership. Generates document using latest
    extraction fields and case data. Creates audit record in generations
    collection. Streams document directly to client.
    """
    start_time = time.time()
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
            detail="You don't have permission to access this case",
        )

    case_type_id = case_data.get("caseTypeId")
    if not case_type_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This case is missing required information",
        )

    try:
        template_config = validate_template(db, case_type_id, template_id)
    except UserFacingError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    source_docs_ref = db.collection("cases").document(case_id).collection("sourceDocuments")
    source_docs = source_docs_ref.where("isLatest", "==", True).stream()

    has_processed_extraction = False
    for source_doc in source_docs:
        source_data = source_doc.to_dict()
        latest_extraction_id = source_data.get("latestExtractionId")

        if latest_extraction_id:
            extraction_doc = db.collection("extractions").document(latest_extraction_id).get()
            if extraction_doc.exists:
                extraction_data = extraction_doc.to_dict()
                if extraction_data.get("status") == "processed":
                    has_processed_extraction = True
                    break

    if not has_processed_extraction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please wait for document processing to complete before generating",
        )

    try:
        aggregated_fields = aggregate_fields(db, case_id)
        context = prepare_template_context(db, case_id, aggregated_fields)
        rendered_bytes = render_document(template_config["storagePath"], context)
    except UserFacingError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        _create_generation_record(
            db=db,
            case_id=case_id,
            case_type_id=case_type_id,
            template_id=template_id,
            template_name=template_config.get("name", "Unknown"),
            output_file_name=template_config.get("documentDownloadName", "document.docx"),
            user_id=user["uid"],
            status="failed",
            error_message=str(e),
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception:
        duration_ms = int((time.time() - start_time) * 1000)
        _create_generation_record(
            db=db,
            case_id=case_id,
            case_type_id=case_type_id,
            template_id=template_id,
            template_name=template_config.get("name", "Unknown"),
            output_file_name=template_config.get("documentDownloadName", "document.docx"),
            user_id=user["uid"],
            status="failed",
            error_message="Failed to generate document. Please try again",
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document. Please try again",
        )

    duration_ms = int((time.time() - start_time) * 1000)
    output_file_name = template_config.get("documentDownloadName", "document.docx")

    _create_generation_record(
        db=db,
        case_id=case_id,
        case_type_id=case_type_id,
        template_id=template_id,
        template_name=template_config.get("name", "Unknown"),
        output_file_name=output_file_name,
        user_id=user["uid"],
        status="completed",
        error_message=None,
        duration_ms=duration_ms,
    )

    return StreamingResponse(
        io.BytesIO(rendered_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{output_file_name}"',
        },
    )


def _create_generation_record(
    db,
    case_id: str,
    case_type_id: str,
    template_id: str,
    template_name: str,
    output_file_name: str,
    user_id: str,
    status: str,
    error_message: str | None,
    duration_ms: int,
) -> None:
    auto_id = db.collection("generations").document().id
    generation_id = f"gen_{auto_id}"
    generation_ref = db.collection("generations").document(generation_id)

    generation_data = {
        "generationId": generation_id,
        "caseId": case_id,
        "userId": user_id,
        "caseTypeId": case_type_id,
        "templateId": template_id,
        "templateName": template_name,
        "status": status,
        "outputFileName": output_file_name,
        "errorMessage": error_message,
        "durationMs": duration_ms,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    }

    if status == "completed":
        generation_data["generatedAt"] = SERVER_TIMESTAMP

    generation_ref.set(generation_data)
