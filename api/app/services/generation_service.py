import io
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from docxtpl import DocxTemplate
from google.cloud.firestore_v1 import SERVER_TIMESTAMP, Client as FirestoreClient

from app.services.firebase import get_db
from app.services.storage import download_file


@dataclass
class GenerationContext:
    db: Any
    generation_ref: Any
    generation_data: dict[str, Any]
    case_ref: Any
    case_id: str
    case_type_id: str
    template_id: str


class UserFacingError(Exception):
    pass


def validate_template(db: FirestoreClient, case_type_id: str, template_id: str) -> dict[str, Any]:
    template_ref = (
        db.collection("caseTypes")
        .document(case_type_id)
        .collection("templates")
        .document(template_id)
    )
    template_doc = template_ref.get()
    if not template_doc.exists:
        raise UserFacingError("Template not found")

    template_data = template_doc.to_dict()
    if not template_data.get("isActive") or template_data.get("deletedAt"):
        raise UserFacingError("This template is no longer available")

    return template_data


def aggregate_fields(db: FirestoreClient, case_id: str) -> dict[str, Any]:
    source_docs_ref = db.collection("cases").document(case_id).collection("sourceDocuments")
    source_docs = source_docs_ref.where("isLatest", "==", True).stream()

    fields = {}
    for source_doc in source_docs:
        source_doc_data = source_doc.to_dict()
        latest_extraction_id = source_doc_data.get("latestExtractionId")

        if not latest_extraction_id:
            continue

        extraction_ref = db.collection("extractions").document(latest_extraction_id)
        extraction_doc = extraction_ref.get()

        if not extraction_doc.exists:
            continue

        extraction_data = extraction_doc.to_dict()
        if extraction_data.get("status") != "processed":
            continue

        extraction_fields = extraction_data.get("fields", {})
        for field_id, field_data in extraction_fields.items():
            if field_id not in fields:
                fields[field_id] = field_data.get("value")

    return fields


def prepare_template_context(
    db: FirestoreClient, case_id: str, aggregated_fields: dict[str, Any]
) -> dict[str, Any]:
    case_ref = db.collection("cases").document(case_id)
    case_doc = case_ref.get()
    case_data = case_doc.to_dict()
    user_fields = case_data.get("userFields", {})

    context = {
        "fields": aggregated_fields,
        "userFields": user_fields,
        "system": {"date": datetime.now().strftime("%B %d, %Y")},
    }

    return context


def render_document(template_storage_path: str, context: dict[str, Any]) -> bytes:
    try:
        template_bytes = download_file(template_storage_path)
    except Exception as e:
        raise UserFacingError("Template file not found. Please contact support") from e

    try:
        template = DocxTemplate(io.BytesIO(template_bytes))
        template.render(context)

        output_buffer = io.BytesIO()
        template.save(output_buffer)
        output_buffer.seek(0)

        return output_buffer.read()
    except Exception as e:
        raise UserFacingError("Failed to generate document. The template may be corrupted") from e


def _load_generation_context(generation_doc_id: str) -> GenerationContext:
    db = get_db()
    generation_ref = db.collection("generations").document(generation_doc_id)
    generation_doc = generation_ref.get()

    if not generation_doc.exists:
        raise ValueError("Generation document not found")

    generation_data = generation_doc.to_dict()
    case_id = generation_data["caseId"]

    case_ref = db.collection("cases").document(case_id)

    return GenerationContext(
        db=db,
        generation_ref=generation_ref,
        generation_data=generation_data,
        case_ref=case_ref,
        case_id=generation_data["caseId"],
        case_type_id=generation_data["caseTypeId"],
        template_id=generation_data["templateId"],
    )


def _update_status_to_generating(generation_context: GenerationContext) -> None:
    generation_context.generation_ref.update(
        {
            "status": "generating",
            "updatedAt": SERVER_TIMESTAMP,
        }
    )


def _load_template_config(generation_context: GenerationContext) -> dict[str, Any]:
    return validate_template(
        generation_context.db, generation_context.case_type_id, generation_context.template_id
    )


def _aggregate_fields(generation_context: GenerationContext) -> dict[str, Any]:
    return aggregate_fields(generation_context.db, generation_context.case_id)


def _prepare_template_context(
    generation_context: GenerationContext, aggregated_fields: dict[str, Any]
) -> dict[str, Any]:
    return prepare_template_context(
        generation_context.db, generation_context.case_id, aggregated_fields
    )


def _render_template(template_storage_path: str, context: dict[str, Any]) -> bytes:
    return render_document(template_storage_path, context)


def _mark_as_latest(generation_context: GenerationContext) -> None:
    generations_query = (
        generation_context.db.collection("generations")
        .where("caseId", "==", generation_context.case_id)
        .where("templateId", "==", generation_context.template_id)
    )
    generations = generations_query.stream()

    batch = generation_context.db.batch()
    for gen_doc in generations:
        if gen_doc.id != generation_context.generation_data["generationId"]:
            batch.update(gen_doc.reference, {"isLatest": False})

    batch.commit()


def _save_generation_results(
    generation_context: GenerationContext,
    output_path: str,
    output_file_name: str,
    duration_ms: int,
) -> None:
    _mark_as_latest(generation_context)

    generation_context.generation_ref.update(
        {
            "status": "completed",
            "isLatest": True,
            "outputPath": output_path,
            "outputFileName": output_file_name,
            "durationMs": duration_ms,
            "generatedAt": SERVER_TIMESTAMP,
            "updatedAt": SERVER_TIMESTAMP,
        }
    )


def _handle_generation_error(
    generation_context: GenerationContext, error: Exception, duration_ms: int
) -> None:
    if isinstance(error, UserFacingError):
        error_message = str(error)
    else:
        error_message = "Failed to generate document. Please try again"

    generation_context.generation_ref.update(
        {
            "status": "failed",
            "errorMessage": error_message,
            "durationMs": duration_ms,
            "updatedAt": SERVER_TIMESTAMP,
        }
    )
