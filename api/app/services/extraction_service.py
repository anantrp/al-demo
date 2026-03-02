import time
import warnings
from dataclasses import dataclass
from typing import Any

import jsonschema
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langsmith import Client as LangSmithClient

from app.config import settings
from app.services.firebase import get_db
from app.services.storage import get_signed_read_url


@dataclass
class ExtractionContext:
    db: Any
    extraction_ref: Any
    extraction_data: dict[str, Any]
    case_ref: Any
    source_doc_ref: Any
    storage_path: str
    case_id: str
    case_type_id: str
    source_document_type_id: str


@dataclass
class DocumentConfigs:
    fields_config: dict[str, Any]
    extracts_fields: list[str]
    doc_name: str
    doc_description: str
    langsmith_prompt_key: str
    extraction_model: str


@dataclass
class ExtractionRequest:
    schema: dict[str, Any]
    signed_url: str
    langsmith_prompt_key: str
    doc_name: str
    doc_description: str
    field_descriptions: list[str]
    required_fields: list[str]
    model: str


@dataclass
class ExtractionResult:
    valid_document: bool
    validity_reason: str
    legible: bool
    fields: dict[str, Any]
    validation_errors: list[dict[str, str]]
    model: str
    langsmith_prompt_key: str


def _load_extraction_context(extraction_doc_id: str) -> ExtractionContext:
    db = get_db()
    extraction_ref = db.collection("extractions").document(extraction_doc_id)
    extraction_doc = extraction_ref.get()

    if not extraction_doc.exists:
        raise ValueError("Extraction document not found")

    extraction_data = extraction_doc.to_dict()
    case_id = extraction_data["caseId"]
    case_source_doc_id = extraction_data["caseSourceDocumentId"]

    case_ref = db.collection("cases").document(case_id)
    source_doc_ref = (
        db.collection("cases")
        .document(case_id)
        .collection("sourceDocuments")
        .document(case_source_doc_id)
    )

    source_doc = source_doc_ref.get()
    if not source_doc.exists:
        raise ValueError("Source document not found")

    storage_path = source_doc.to_dict()["storagePath"]

    return ExtractionContext(
        db=db,
        extraction_ref=extraction_ref,
        extraction_data=extraction_data,
        case_ref=case_ref,
        source_doc_ref=source_doc_ref,
        storage_path=storage_path,
        case_id=extraction_data["caseId"],
        case_type_id=extraction_data["caseTypeId"],
        source_document_type_id=extraction_data["sourceDocumentTypeId"],
    )


def _update_status_to_processing(extraction_context: ExtractionContext) -> None:
    extraction_context.extraction_ref.update(
        {
            "status": "processing",
            "updatedAt": SERVER_TIMESTAMP,
        }
    )
    extraction_context.source_doc_ref.update(
        {
            "status": "processing",
            "updatedAt": SERVER_TIMESTAMP,
        }
    )


def _load_document_configs(extraction_context: ExtractionContext) -> DocumentConfigs:
    case_type_ref = extraction_context.db.collection("caseTypes").document(
        extraction_context.case_type_id
    )
    case_type_doc = case_type_ref.get()
    case_type_data = case_type_doc.to_dict()
    fields_config = case_type_data["fields"]

    source_type_ref = (
        extraction_context.db.collection("caseTypes")
        .document(extraction_context.case_type_id)
        .collection("sourceDocuments")
        .document(extraction_context.source_document_type_id)
    )
    source_type_doc = source_type_ref.get()
    source_type_data = source_type_doc.to_dict()

    extracts_fields = source_type_data.get("extractsFields", [])
    doc_name = source_type_data.get("name", "document")
    doc_description = source_type_data.get("description", "")
    extraction_config = source_type_data.get("extractionConfig", {})
    langsmith_prompt_key = extraction_config.get("langsmithPromptKey", "")
    extraction_model = extraction_config.get("model", "")

    return DocumentConfigs(
        fields_config=fields_config,
        extracts_fields=extracts_fields,
        doc_name=doc_name,
        doc_description=doc_description,
        langsmith_prompt_key=langsmith_prompt_key,
        extraction_model=extraction_model,
    )


def _build_field_descriptions(
    extracts_fields: list[str], fields_config: dict[str, Any]
) -> tuple[list[str], list[str]]:
    field_descriptions = []
    required_fields = []

    for field_id in extracts_fields:
        if field_id in fields_config:
            field_context = fields_config[field_id]
            field_descriptions.append(f"- {field_id}: {field_context.get('label', field_id)}")
            if field_context.get("required", False):
                required_fields.append(field_id)

    return field_descriptions, required_fields


def _build_value_property(field_context: dict[str, Any]) -> dict[str, Any]:
    field_schema = field_context.get("schema", {})
    base_type = field_schema.get("type", "string")
    is_required = field_context.get("required", False)

    value_property: dict[str, Any] = {"description": field_context.get("label", "")}
    value_property["type"] = base_type if is_required else [base_type, "null"]

    if base_type == "string":
        if "format" in field_schema:
            value_property["format"] = field_schema["format"]
        if "pattern" in field_schema:
            value_property["pattern"] = field_schema["pattern"]

    if base_type in ("integer", "number"):
        if "minimum" in field_schema:
            value_property["minimum"] = field_schema["minimum"]
        if "maximum" in field_schema:
            value_property["maximum"] = field_schema["maximum"]

    return value_property


def _build_extraction_schema(
    extracts_fields: list[str], fields_config: dict[str, Any], doc_name: str, doc_description: str
) -> dict[str, Any]:
    field_properties = {}

    for field_id in extracts_fields:
        if field_id not in fields_config:
            continue

        field_context = fields_config[field_id]
        value_property = _build_value_property(field_context)

        field_properties[field_id] = {
            "type": "object",
            "properties": {
                "value": value_property,
                "confidence": {
                    "type": "number",
                    "description": "Confidence score between 0.0 and 1.0",
                    "minimum": 0.0,
                    "maximum": 1.0,
                },
            },
            "required": ["value", "confidence"],
            "additionalProperties": False,
        }

    return {
        "type": "object",
        "properties": {
            "valid_document": {
                "type": "boolean",
                "description": f"Whether this is a valid {doc_name} document as described: {doc_description}",
            },
            "validity_reason": {
                "type": "string",
                "description": "Short description (1-2 sentences) explaining why the document is valid or invalid",
            },
            "legible": {
                "type": "boolean",
                "description": "Whether the document is legible and readable enough to extract required fields",
            },
            "extracted_fields": {
                "type": "object",
                "properties": field_properties,
                "additionalProperties": False,
                "required": list(field_properties.keys()),
            },
        },
        "required": ["valid_document", "validity_reason", "legible", "extracted_fields"],
        "additionalProperties": False,
    }


def _prepare_extraction_request(
    extraction_context: ExtractionContext, document_configs: DocumentConfigs
) -> ExtractionRequest:
    if not document_configs.langsmith_prompt_key:
        raise ValueError("langsmithPromptKey is required in extractionConfig")

    field_descriptions, required_fields = _build_field_descriptions(
        document_configs.extracts_fields, document_configs.fields_config
    )

    extraction_schema = _build_extraction_schema(
        document_configs.extracts_fields,
        document_configs.fields_config,
        document_configs.doc_name,
        document_configs.doc_description,
    )

    if not extraction_schema["properties"].get("extracted_fields", {}).get("properties"):
        raise ValueError("No extractable fields configured")

    signed_url = get_signed_read_url(extraction_context.storage_path, expiry_minutes=15)

    return ExtractionRequest(
        schema=extraction_schema,
        signed_url=signed_url,
        langsmith_prompt_key=document_configs.langsmith_prompt_key,
        doc_name=document_configs.doc_name,
        doc_description=document_configs.doc_description,
        field_descriptions=field_descriptions,
        required_fields=required_fields,
        model=document_configs.extraction_model,
    )


def _call_extraction_api(request: ExtractionRequest) -> tuple[dict[str, Any], str]:
    langsmith_client = LangSmithClient(
        api_key=settings.LANGSMITH_API_KEY,
        api_url=settings.LANGSMITH_ENDPOINT,
    )
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*extra_headers.*")
        runnable = langsmith_client.pull_prompt(request.langsmith_prompt_key, include_model=True)

    prompt_template = runnable.first
    langsmith_llm = runnable.last

    model_name = request.model or langsmith_llm.model_name
    llm = ChatOpenAI(model=model_name, api_key=settings.OPENAI_API_KEY)
    schema = {"title": "extraction_result", **request.schema}
    structured_llm = llm.with_structured_output(schema, strict=True)

    formatted_messages = prompt_template.format_messages(
        doc_name=request.doc_name,
        doc_description=request.doc_description,
        fields_section="\n".join(request.field_descriptions),
        required_fields_section=", ".join(request.required_fields)
        if request.required_fields
        else "none",
    )

    last_message = formatted_messages[-1]
    multimodal_last = HumanMessage(
        content=[
            {"type": "text", "text": last_message.content},
            {"type": "image_url", "image_url": {"url": request.signed_url, "detail": "high"}},
        ]
    )
    messages = [*formatted_messages[:-1], multimodal_last]

    result = structured_llm.invoke(messages)
    return result, llm.model_name


def _validate_field_value(value: Any, field_id: str, field_context: dict[str, Any]) -> None:
    field_schema = field_context.get("schema", {})
    if field_schema.get("type") == "integer" and not isinstance(value, int):
        value = int(value)

    jsonschema.validate(
        {"v": value}, {"type": "object", "properties": {"v": field_schema}, "required": ["v"]}
    )


def _process_field(
    field_id: str,
    raw_field_data: dict[str, Any],
    field_context: dict[str, Any],
    validation_errors: list[dict[str, str]],
) -> dict[str, Any]:
    field_value = raw_field_data.get("value") if isinstance(raw_field_data, dict) else None
    field_confidence = (
        raw_field_data.get("confidence", 0.0) if isinstance(raw_field_data, dict) else 0.0
    )

    if field_value is None and field_context.get("required", False):
        validation_errors.append({"rule": "required", "message": f"{field_id} is required"})

    if field_value is None:
        return {
            "value": None,
            "confidence": field_confidence,
            "flagged": False,
            "flagReason": None,
        }

    try:
        _validate_field_value(field_value, field_id, field_context)
        return {
            "value": field_value,
            "confidence": field_confidence,
            "flagged": False,
            "flagReason": None,
        }
    except (ValueError, jsonschema.ValidationError) as validation_error:
        validation_errors.append({"rule": "schema", "message": f"{field_id}: {validation_error!s}"})
        return {
            "value": field_value,
            "confidence": field_confidence,
            "flagged": True,
            "flagReason": f"Validation failed: {validation_error!s}",
        }


def _process_extraction_response(
    raw_response: dict[str, Any], document_configs: DocumentConfigs, actual_model: str
) -> ExtractionResult:
    is_valid_document = raw_response.get("valid_document", True)
    validity_reason = raw_response.get("validity_reason", "")
    is_legible = raw_response.get("legible", True)
    raw_extracted_fields = raw_response.get("extracted_fields", {})

    processed_fields: dict[str, Any] = {}
    validation_errors = []

    if is_valid_document and is_legible:
        for field_id in document_configs.extracts_fields:
            if field_id not in document_configs.fields_config:
                continue

            field_context = document_configs.fields_config[field_id]
            raw_field_data = raw_extracted_fields.get(field_id, {})
            processed_fields[field_id] = _process_field(
                field_id, raw_field_data, field_context, validation_errors
            )

    return ExtractionResult(
        valid_document=is_valid_document,
        validity_reason=validity_reason,
        legible=is_legible,
        fields=processed_fields,
        validation_errors=validation_errors,
        model=actual_model,
        langsmith_prompt_key=document_configs.langsmith_prompt_key,
    )


def _determine_extraction_status(extraction_result: ExtractionResult) -> tuple[str, str | None]:
    if not extraction_result.valid_document:
        return "invalid", extraction_result.validity_reason or None
    if not extraction_result.legible:
        return "invalid", "Document is not legible enough to extract required fields"
    if extraction_result.validation_errors:
        return "flagged", None
    return "processed", None


def _save_extraction_results(
    extraction_context: ExtractionContext, extraction_result: ExtractionResult, duration_ms: int
) -> None:
    extraction_status, validity_reason = _determine_extraction_status(extraction_result)

    extraction_context.extraction_ref.update(
        {
            "status": extraction_status,
            "valid": extraction_result.valid_document,
            "validityReason": validity_reason,
            "legible": extraction_result.legible,
            "fields": extraction_result.fields if extraction_result.fields else None,
            "validationErrors": extraction_result.validation_errors
            if extraction_result.validation_errors
            else None,
            "extractionConfig": {
                "model": extraction_result.model,
                "langsmithPromptKey": extraction_result.langsmith_prompt_key,
            },
            "durationMs": duration_ms,
            "extractedAt": SERVER_TIMESTAMP,
            "updatedAt": SERVER_TIMESTAMP,
        }
    )

    extraction_context.source_doc_ref.update(
        {
            "latestExtractionId": extraction_context.extraction_data["extractionId"],
            "status": extraction_status,
            "validityReason": validity_reason,
            "updatedAt": SERVER_TIMESTAMP,
        }
    )


def _handle_extraction_error(
    extraction_context: ExtractionContext, error: Exception, duration_ms: int
) -> None:
    extraction_context.extraction_ref.update(
        {
            "status": "failed",
            "errorMessage": str(error),
            "durationMs": duration_ms,
            "updatedAt": SERVER_TIMESTAMP,
        }
    )
    extraction_context.source_doc_ref.update(
        {
            "status": "failed",
            "updatedAt": SERVER_TIMESTAMP,
        }
    )


def run_extraction(extraction_doc_id: str) -> None:
    start_time = time.time()

    try:
        extraction_context = _load_extraction_context(extraction_doc_id)
    except ValueError:
        return

    try:
        _update_status_to_processing(extraction_context)
        document_configs = _load_document_configs(extraction_context)
        extraction_request = _prepare_extraction_request(extraction_context, document_configs)
        api_response, actual_model = _call_extraction_api(extraction_request)
        extraction_result = _process_extraction_response(
            api_response, document_configs, actual_model
        )

        duration_ms = int((time.time() - start_time) * 1000)
        _save_extraction_results(extraction_context, extraction_result, duration_ms)

    except Exception as extraction_error:
        duration_ms = int((time.time() - start_time) * 1000)
        _handle_extraction_error(extraction_context, extraction_error, duration_ms)
        raise
