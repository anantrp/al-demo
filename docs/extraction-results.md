# Document Extraction Results

## Status Model

### `extractions/{id}.status`

| Value | Meaning |
|---|---|
| `pending` | Queued, not yet started |
| `processing` | Extraction in progress |
| `processed` | Valid, legible, all fields passed validation |
| `invalid` | Wrong document type or illegible — `validityReason` is set |
| `flagged` | Valid and legible but field-level validation errors — `validationErrors` is set |
| `failed` | System or API exception — `errorMessage` is set |

### `cases/{caseId}/sourceDocuments/{docId}` — mirrored fields

The `status` and `validityReason` fields are mirrored onto the source document for efficient real-time display without fetching the full extraction document.

---

## Extraction Document Structure

### Top-Level Fields

```json
{
  "status": "processed | invalid | flagged | failed",
  "valid": boolean,
  "validityReason": "string | null",
  "legible": boolean,
  "fields": "object | null",
  "validationErrors": "array | null",
  "errorMessage": "string | null",
  "extractionConfig": { "model": "string", "langsmithPromptKey": "string" },
  "durationMs": "number"
}
```

- **status**: outcome of the extraction (see table above)
- **valid**: whether the document matches the expected type
- **validityReason**: set when `status` is `invalid` — explains why (wrong type or illegible)
- **legible**: whether the document was readable enough for extraction
- **fields**: extracted data — only set when `valid: true` and `legible: true`, else `null`
- **validationErrors**: field-level errors (schema violations, missing required fields) — only set when `status` is `flagged`
- **errorMessage**: set only on system/API exceptions (`status: failed`)

### Field-Level Structure

```json
{
  "value": "any",
  "confidence": "number",
  "flagged": "boolean",
  "flagReason": "string | null"
}
```

- **flagged / flagReason**: set for schema validation failures only

---

## Scenarios

### 1. Valid Document — All Good

```json
{
  "status": "processed",
  "valid": true,
  "validityReason": null,
  "legible": true,
  "fields": {
    "deceased_name": { "value": "John Smith", "confidence": 0.98, "flagged": false, "flagReason": null },
    "date_of_birth": { "value": "1945-03-15", "confidence": 0.95, "flagged": false, "flagReason": null },
    "age_at_death": { "value": 78, "confidence": 0.99, "flagged": false, "flagReason": null }
  },
  "validationErrors": null
}
```

### 2. Valid Document — Schema Validation Errors

Fields fail schema validation (e.g. negative age, invalid SSN format).

```json
{
  "status": "flagged",
  "valid": true,
  "validityReason": null,
  "legible": true,
  "fields": {
    "deceased_name": { "value": "Jane Doe", "confidence": 0.97, "flagged": false, "flagReason": null },
    "age_at_death": { "value": -5, "confidence": 0.85, "flagged": true, "flagReason": "Validation failed: -5 is less than the minimum of 0" },
    "ssn": { "value": "123456789", "confidence": 0.88, "flagged": true, "flagReason": "Validation failed: '123456789' does not match '^\\d{3}-\\d{2}-\\d{4}$'" }
  },
  "validationErrors": [
    { "rule": "schema", "message": "age_at_death: -5 is less than the minimum of 0" },
    { "rule": "schema", "message": "ssn: '123456789' does not match '^\\d{3}-\\d{2}-\\d{4}$'" }
  ]
}
```

### 3. Valid Document — Missing Required Fields

Document is the correct type but required fields could not be extracted.

```json
{
  "status": "flagged",
  "valid": true,
  "validityReason": null,
  "legible": true,
  "fields": {
    "deceased_name": { "value": "Robert Wilson", "confidence": 0.96, "flagged": false, "flagReason": null },
    "date_of_birth": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null },
    "age_at_death": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null }
  },
  "validationErrors": [
    { "rule": "required", "message": "date_of_birth is required" },
    { "rule": "required", "message": "age_at_death is required" }
  ]
}
```

### 4. Invalid Document Type

Wrong document type (e.g. driver's license instead of death certificate). Fields are not extracted.

```json
{
  "status": "invalid",
  "valid": false,
  "validityReason": "This appears to be a driver's license, not a death certificate.",
  "legible": true,
  "fields": null,
  "validationErrors": null
}
```

### 5. Illegible Document

Correct document type but too blurry or damaged to extract fields.

```json
{
  "status": "invalid",
  "valid": true,
  "validityReason": "Document is not legible enough to extract required fields",
  "legible": false,
  "fields": null,
  "validationErrors": null
}
```

### 6. Execution Failure

API errors, network issues, or processing exceptions.

```json
{
  "status": "failed",
  "errorMessage": "OpenAI API request failed: Rate limit exceeded",
  "durationMs": 350
}
```

---

## Summary

| Scenario | valid | legible | fields | validationErrors | status |
|---|---|---|---|---|---|
| All Good | true | true | {...} | null | processed |
| Schema Errors | true | true | {...} | [...] | flagged |
| Missing Required | true | true | {...} | [...] | flagged |
| Invalid Type | false | true | null | null | invalid |
| Illegible | true | false | null | null | invalid |
| Execution Failure | — | — | — | — | failed |

### Key Rules

- **validityReason**: set when `status` is `invalid` (wrong type or illegible)
- **fields**: only when `valid: true` and `legible: true`
- **validationErrors**: only when `status` is `flagged`
- **errorMessage**: only on system/API failures (`status: failed`)
- **flagReason** on fields: only for schema validation failures, not for missing required fields
