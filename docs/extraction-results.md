# Document Extraction Results

## Output Structure

### Top-Level Fields

```json
{
  "status": "extracted" | "failed",
  "valid": boolean,
  "validityReason": string | null,
  "legible": boolean,
  "fields": object | null,
  "validationErrors": array | null,
  "validationReason": string | null,
  "errorMessage": string | null,
  "extractionConfig": { "model": string, "promptVersion": string },
  "durationMs": number
}
```

- **status**: `extracted` on success, `failed` on validation/execution errors
- **valid**: Document matches expected type
- **validityReason**: Why document is invalid (only when `valid: false`)
- **legible**: Document quality sufficient for extraction
- **fields**: Extracted data (only when `valid: true`, else `null`)
- **validationErrors**: Schema violations, missing required fields, legibility issues
- **validationReason**: Reserved for case-type custom validation
- **errorMessage**: Set only on execution failures (API errors, exceptions)

### Field-Level Structure

```json
{
  "value": any,
  "confidence": number,
  "flagged": boolean,
  "flagReason": string | null
}
```

- **flagReason**: Only set for schema validation failures

## Scenarios

### 1. Valid Document - All Good

Perfect document with all fields extracted and validated successfully.

```json
{
  "status": "extracted",
  "valid": true,
  "validityReason": null,
  "legible": true,
  "fields": {
    "deceased_name": { "value": "John Smith", "confidence": 0.98, "flagged": false, "flagReason": null },
    "date_of_birth": { "value": "1945-03-15", "confidence": 0.95, "flagged": false, "flagReason": null },
    "age_at_death": { "value": 78, "confidence": 0.99, "flagged": false, "flagReason": null }
  },
  "validationErrors": null,
  "validationReason": null
}
```

### 2. Valid Document - Schema Validation Errors

Fields fail schema validation (negative age, invalid SSN format).

```json
{
  "status": "failed",
  "valid": true,
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

### 3. Valid Document - Missing Required Fields

Document is correct type but missing required fields. Note: missing fields have `value: null` but are NOT flagged.

```json
{
  "status": "failed",
  "valid": true,
  "legible": true,
  "fields": {
    "deceased_name": { "value": "Robert Wilson", "confidence": 0.96, "flagged": false, "flagReason": null },
    "date_of_birth": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null },
    "age_at_death": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null },
    "certificate_number": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null }
  },
  "validationErrors": [
    { "rule": "required", "message": "date_of_birth is required" },
    { "rule": "required", "message": "age_at_death is required" },
    { "rule": "required", "message": "certificate_number is required" }
  ]
}
```

### 4. Invalid Document Type

Wrong document type (e.g., driver's license instead of death certificate). Fields are not extracted (`null`).

```json
{
  "status": "extracted",
  "valid": false,
  "validityReason": "This appears to be a driver's license, not a death certificate.",
  "legible": true,
  "fields": null,
  "validationErrors": null
}
```

### 5. Illegible Document

Correct type but too blurry/damaged to extract. Legibility error appears in `validationErrors`.

```json
{
  "status": "failed",
  "valid": true,
  "legible": false,
  "fields": {
    "deceased_name": { "value": null, "confidence": 0.3, "flagged": false, "flagReason": null },
    "date_of_birth": { "value": null, "confidence": 0.2, "flagged": false, "flagReason": null },
    "age_at_death": { "value": null, "confidence": 0.0, "flagged": false, "flagReason": null }
  },
  "validationErrors": [
    { "rule": "legibility", "message": "Document is not legible enough to extract required fields" },
    { "rule": "required", "message": "deceased_name is required" },
    { "rule": "required", "message": "date_of_birth is required" }
  ]
}
```

### 6. Execution Failure

API errors, network issues, or processing exceptions. Only `errorMessage` is set.

```json
{
  "status": "failed",
  "errorMessage": "OpenAI API request failed: Rate limit exceeded",
  "durationMs": 350
}
```

### 7. Custom Validation (Future)

`validationReason` is reserved for case-type cross-field validation (e.g., date consistency, age calculations).

```json
{
  "status": "failed",
  "valid": true,
  "legible": true,
  "fields": { /* ... */ },
  "validationReason": "Age at death (10) inconsistent with date of birth and death (3-year difference)"
}
```

## Summary

| Scenario | valid | validityReason | legible | fields | validationErrors | status |
|----------|-------|----------------|---------|--------|------------------|--------|
| All Good | true | null | true | {...} | null | extracted |
| Schema Errors | true | null | true | {...} | [...] | failed |
| Missing Required | true | null | true | {...} | [...] | failed |
| Invalid Type | false | "..." | true | null | null | extracted |
| Illegible | true | null | false | {...} | [...] | failed |
| Execution Failure | - | - | - | - | - | failed |

### Key Rules

- **errorMessage**: Only on execution failures (API/network errors)
- **validityReason**: Only when `valid: false` (wrong document type)
- **fields**: Only when `valid: true`, else `null`
- **flagReason**: Only for schema validation failures
- **validationReason**: Reserved for case-type custom validation
- **status**: `extracted` on success, `failed` on validation/execution errors
