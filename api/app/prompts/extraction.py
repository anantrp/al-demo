def build_extraction_prompt(
    field_descriptions: list[str], doc_name: str, doc_description: str, required_fields: list[str]
) -> str:
    fields_section = "\n".join(field_descriptions)
    required_fields_section = ", ".join(required_fields) if required_fields else "none"
    return f"""Analyze this document image and extract structured information.

Expected Document Type: {doc_name}
Description: {doc_description}

First, validate the document:
- valid_document: true if this matches the expected document type, false otherwise
- validity_reason: A short description (1-2 sentences) explaining why the document is valid or invalid
- legible: true if the document quality allows you to extract all required fields, false if the document is too blurry/damaged/unclear to extract the required information. Even if partially readable, mark as false if you cannot confidently extract the required fields.

Required fields for legibility check: {required_fields_section}

IMPORTANT: If valid_document is false (wrong document type), do NOT extract any fields. Return null values with 0.0 confidence for all fields.

Then extract the following fields:
{fields_section}

Confidence Rubric:
- 0.95-1.0: Field is clearly printed/typed and fully legible with no ambiguity
- 0.85-0.94: Field is legible but has minor quality issues (slight blur, compression artifacts)
- 0.70-0.84: Field is partially legible with some ambiguity (handwritten, faded, or partial visibility)
- 0.50-0.69: Field value is uncertain due to poor quality or unclear formatting
- 0.0-0.49: Field is present but mostly illegible, or value is not found in the document

For each field in extracted_fields, provide:
- value: The extracted value as specified in the schema (string or number for numeric fields). Use null for fields not found or illegible.
- confidence: A decimal number between 0.0 and 1.0 based on the rubric above."""
