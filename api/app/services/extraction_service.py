import json
import time
from typing import Any

import jsonschema
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from openai import OpenAI

from app.config import settings
from app.prompts.extraction import build_extraction_prompt
from app.services.firebase import get_db
from app.services.storage import get_signed_read_url


def _build_extraction_schema(
    extracts_fields: list[str], fields_config: dict[str, Any]
) -> dict[str, Any]:
    properties = {}
    for field_id in extracts_fields:
        if field_id not in fields_config:
            continue
        fc = fields_config[field_id]
        schema = fc.get("schema", {})
        base_type = schema.get("type", "string")
        required = fc.get("required", False)
        prop: dict[str, Any] = {"description": fc.get("label", field_id)}
        if required:
            prop["type"] = base_type
        else:
            prop["type"] = [base_type, "null"]
        if base_type == "string" and "format" in schema:
            prop["format"] = schema["format"]
        if base_type == "string" and "pattern" in schema:
            prop["pattern"] = schema["pattern"]
        if base_type in ("integer", "number") and "minimum" in schema:
            prop["minimum"] = schema["minimum"]
        if base_type in ("integer", "number") and "maximum" in schema:
            prop["maximum"] = schema["maximum"]
        properties[field_id] = prop
    return {
        "type": "object",
        "properties": properties,
        "additionalProperties": False,
        "required": list(properties.keys()),
    }


def run_extraction(extraction_doc_id: str) -> None:
    db = get_db()
    extraction_ref = db.collection("extractions").document(extraction_doc_id)
    extraction_doc = extraction_ref.get()
    if not extraction_doc.exists:
        return

    extraction_data = extraction_doc.to_dict()
    case_id = extraction_data["caseId"]
    case_source_doc_id = extraction_data["caseSourceDocumentId"]
    case_type_id = extraction_data["caseTypeId"]
    source_document_type_id = extraction_data["sourceDocumentTypeId"]
    case_ref = db.collection("cases").document(case_id)

    start_time = time.time()

    try:
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

        extraction_ref.update(
            {
                "status": "extracting",
                "updatedAt": SERVER_TIMESTAMP,
            }
        )
        case_ref.update(
            {
                "status": "extracting",
                "latestExtractionId": extraction_data["extractionId"],
                "updatedAt": SERVER_TIMESTAMP,
            }
        )

        signed_url = get_signed_read_url(storage_path, expiry_minutes=15)

        case_type_ref = db.collection("caseTypes").document(case_type_id)
        case_type_doc = case_type_ref.get()
        case_type_data = case_type_doc.to_dict()
        fields_config = case_type_data["fields"]

        source_type_ref = (
            db.collection("caseTypes")
            .document(case_type_id)
            .collection("sourceDocuments")
            .document(source_document_type_id)
        )
        source_type_doc = source_type_ref.get()
        source_type_data = source_type_doc.to_dict()
        extracts_fields = source_type_data.get("extractsFields", [])

        field_descriptions = []
        for field_id in extracts_fields:
            if field_id in fields_config:
                fc = fields_config[field_id]
                field_descriptions.append(f"- {field_id}: {fc.get('label', field_id)}")
        prompt = build_extraction_prompt(field_descriptions)

        extraction_schema = _build_extraction_schema(extracts_fields, fields_config)
        if not extraction_schema["properties"]:
            raise ValueError("No extractable fields configured")

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": signed_url, "detail": "high"},
                        },
                    ],
                }
            ],
            max_tokens=4000,
            temperature=0.3,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "extraction_result",
                    "strict": True,
                    "schema": extraction_schema,
                },
            },
        )

        message = response.choices[0].message
        if message.refusal:
            raise ValueError(f"Model refused: {message.refusal}")

        content = message.content
        if not content:
            raise ValueError("Empty response from model")

        raw_fields = json.loads(content)
        fields: dict[str, Any] = {}
        validation_errors = []

        for field_id in extracts_fields:
            if field_id not in fields_config:
                continue
            fc = fields_config[field_id]
            schema = fc.get("schema", {})
            value = raw_fields.get(field_id)
            if value is None and fc.get("required", False):
                validation_errors.append({"rule": "required", "message": f"{field_id} is required"})
                fields[field_id] = {
                    "value": None,
                    "confidence": 0.0,
                    "flagged": True,
                    "flagReason": "Missing",
                }
                continue
            if value is None:
                fields[field_id] = {
                    "value": None,
                    "confidence": 0.0,
                    "flagged": False,
                    "flagReason": None,
                }
                continue
            try:
                if schema.get("type") == "integer":
                    value = int(value) if not isinstance(value, int) else value
                jsonschema.validate(
                    {"v": value}, {"type": "object", "properties": {"v": schema}, "required": ["v"]}
                )
                fields[field_id] = {
                    "value": value,
                    "confidence": 0.95,
                    "flagged": False,
                    "flagReason": None,
                }
            except (ValueError, jsonschema.ValidationError) as e:
                validation_errors.append({"rule": "schema", "message": f"{field_id}: {e}"})
                fields[field_id] = {
                    "value": value,
                    "confidence": 0.5,
                    "flagged": True,
                    "flagReason": str(e),
                }

        duration_ms = int((time.time() - start_time) * 1000)
        status = "extracted" if not validation_errors else "failed"

        extraction_ref.update(
            {
                "status": status,
                "fields": fields,
                "validationErrors": validation_errors if validation_errors else None,
                "extractionConfig": {
                    "model": "gpt-4o-2024-08-06",
                    "api": "chat_completions",
                    "temperature": 0.3,
                    "maxTokens": 4000,
                    "promptVersion": "v1",
                },
                "durationMs": duration_ms,
                "extractedAt": SERVER_TIMESTAMP,
                "updatedAt": SERVER_TIMESTAMP,
            }
        )
        case_ref.update(
            {
                "status": status,
                "extractionStatus": status,
                "updatedAt": SERVER_TIMESTAMP,
            }
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        extraction_ref.update(
            {
                "status": "failed",
                "errorMessage": str(e),
                "durationMs": duration_ms,
                "updatedAt": SERVER_TIMESTAMP,
            }
        )
        case_ref.update(
            {
                "status": "failed",
                "extractionStatus": "failed",
                "updatedAt": SERVER_TIMESTAMP,
            }
        )
        raise
