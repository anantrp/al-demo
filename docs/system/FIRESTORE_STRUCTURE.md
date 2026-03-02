# Firestore Schema

## Collection Overview

```
users/
caseTypes/
  └── sourceDocuments/
  └── templates/
cases/
  └── sourceDocuments/
extractions/
generations/
```

## ID Patterns

**Config Collections (Semantic IDs):**

- `caseTypes/{caseTypeId}` - e.g., `death_certificate_flow`
- `sourceDocuments/{sourceDocumentTypeId}` - e.g., `death_certificate_image`
- `templates/{templateId}` - e.g., `social_security`

**Runtime Collections (Prefixed Auto-IDs):**

- `cases/{caseId}` - e.g., `case_abc123xyz`
- `extractions/{extractionId}` - e.g., `ext_abc123xyz`
- `generations/{generationId}` - e.g., `gen_abc123xyz`

All documents store their ID in the body for clean serialization.

---

## Schema Definitions

### users/{userId}

```json
{
  "userId": "firebase_auth_uid"
}
```

---

### caseTypes/{caseTypeId}

```json
{
  "caseTypeId": "death_certificate_flow",
  "name": "Death Certificate Processing",
  "description": "Process death certificates and generate administrative documents",
  "userForm": {
    "heading": "Your Information",
    "subheading": "Provide your contact information and relationship to the deceased for this case."
  },
  "fields": {
    "deceased_name": {
      "label": "Full Name of Deceased",
      "required": true,
      "schema": {
        "type": "string",
        "minLength": 1
      }
    },
    "date_of_birth": {
      "label": "Date of Birth",
      "required": true,
      "schema": {
        "type": "string",
        "format": "date"
      }
    },
    "date_of_death": {
      "label": "Date of Death",
      "required": true,
      "schema": {
        "type": "string",
        "format": "date"
      }
    },
    "age_at_death": {
      "label": "Age at Death",
      "required": true,
      "schema": {
        "type": "integer",
        "minimum": 0
      }
    },
    "ssn": {
      "label": "Social Security Number",
      "required": false,
      "schema": {
        "type": "string",
        "pattern": "^\\d{3}-\\d{2}-\\d{4}$"
      }
    },
    "cause_of_death": {
      "label": "Cause of Death",
      "required": true,
      "schema": {
        "type": "string",
        "minLength": 1
      }
    },
    "place_of_death": {
      "label": "Place of Death",
      "required": true,
      "schema": {
        "type": "string",
        "minLength": 1
      }
    },
    "issuing_authority": {
      "label": "Issuing Authority",
      "required": true,
      "schema": {
        "type": "string",
        "minLength": 1
      }
    },
    "certificate_number": {
      "label": "Certificate Number",
      "required": true,
      "schema": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "userFields": {
    "full_name": {
      "label": "Full Name",
      "required": false,
      "order": 1,
      "cols": 2,
      "placeholder": "Enter your full name",
      "schema": {
        "type": "string",
        "minLength": 1
      }
    },
    "address_line_1": {
      "label": "Address Line 1",
      "required": false,
      "order": 2,
      "cols": 2,
      "placeholder": "Street address",
      "schema": {
        "type": "string"
      }
    },
    "address_line_2": {
      "label": "Address Line 2",
      "required": false,
      "order": 3,
      "cols": 2,
      "placeholder": "Apt, suite, unit, etc. (optional)",
      "schema": {
        "type": "string"
      }
    },
    "city": {
      "label": "City",
      "required": false,
      "order": 4,
      "cols": 1,
      "placeholder": "City",
      "schema": {
        "type": "string"
      }
    },
    "state": {
      "label": "State",
      "required": false,
      "order": 5,
      "cols": 1,
      "placeholder": "Select state",
      "options": [
        { "label": "Alabama", "value": "AL" },
        { "label": "Alaska", "value": "AK" },
        { "label": "California", "value": "CA" },
        { "label": "New York", "value": "NY" }
      ],
      "schema": {
        "type": "string"
      }
    },
    "zip_code": {
      "label": "Zip Code",
      "required": false,
      "order": 6,
      "cols": 1,
      "placeholder": "12345",
      "schema": {
        "type": "string",
        "pattern": "^\\d{5}(-\\d{4})?$"
      }
    },
    "email_address": {
      "label": "Email Address",
      "required": false,
      "order": 7,
      "cols": 1,
      "placeholder": "you@example.com",
      "schema": {
        "type": "string",
        "format": "email"
      }
    },
    "phone_number": {
      "label": "Phone Number",
      "required": false,
      "order": 8,
      "cols": 1,
      "placeholder": "(555) 123-4567",
      "schema": {
        "type": "string",
        "pattern": "^\\+?1?\\d{10,14}$"
      }
    },
    "relationship": {
      "label": "Relationship to Deceased",
      "required": false,
      "order": 9,
      "cols": 2,
      "placeholder": "e.g., Spouse, Son, Daughter, Executor",
      "schema": {
        "type": "string"
      }
    }
  },
  "customValidations": [
    "date_order",
    "age_consistency",
    "ssn_format",
    "no_future_date"
  ],
  "isActive": true,
  "deletedAt": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**User Form Configuration:**

- `userForm`: Optional configuration for the user information form modal
  - `heading`: Custom heading text for the form dialog (optional, defaults to "Your Information")
  - `subheading`: Custom description text for the form dialog (optional)

**Field Types:**

- `fields`: Extracted from source documents (e.g., death certificate image)
- `userFields`: Provided by the user (e.g., their contact information and relationship to deceased)
  - `order`: Controls display order in form (optional, numeric)
  - `cols`: Column span in 2-column grid layout (1 or 2, optional, defaults to 1)
  - `placeholder`: Placeholder text for input/select fields (optional, string)
  - `options`: Array of select options for dropdown fields (optional, array of `{label: string, value: string}`)
    - When `options` is present, field renders as a shadcn Select component instead of an Input
    - Example: US states, countries, predefined categories

---

### caseTypes/{caseTypeId}/sourceDocuments/{sourceDocumentTypeId}

```json
{
  "sourceDocumentTypeId": "death_certificate_image",
  "name": "Death Certificate Image",
  "description": "Scanned or photographed death certificate",
  "extractsFields": [
    "deceased_name",
    "date_of_birth",
    "date_of_death",
    "age_at_death",
    "ssn",
    "cause_of_death",
    "place_of_death",
    "issuing_authority",
    "certificate_number"
  ],
  "acceptedMimeTypes": ["image/jpeg", "image/png"],
  "maxFileSizeMB": 10,
  "isActive": true,
  "deletedAt": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### caseTypes/{caseTypeId}/templates/{templateId}

```json
{
  "templateId": "social_security",
  "name": "Social Security Administration - Report of Death",
  "description": "Official notification to SSA of deceased individual",
  "referenceFields": [
    "deceased_name",
    "ssn",
    "date_of_death",
    "date_of_birth",
    "place_of_death",
    "certificate_number",
    "issuing_authority"
  ],
  "referenceUserFields": [
    "full_name",
    "address_line_1",
    "address_line_2",
    "city",
    "state",
    "zip_code",
    "email_address",
    "phone_number",
    "relationship"
  ],
  "storagePath": "templates/death_certificate_flow/social_security/v1.docx",
  "version": "1.0.0",
  "isActive": true,
  "deletedAt": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Template Field References:**

- `referenceFields`: References extracted fields from source documents
- `referenceUserFields`: References user-provided fields from case.userFields

---

### cases/{caseId}

```json
{
  "caseId": "case_abc123xyz",
  "userId": "firebase_auth_uid",
  "caseTypeId": "death_certificate_flow",
  "name": "Mom's death certificate processing",
  "userFields": {
    "full_name": "John Smith",
    "address_line_1": "123 Main St",
    "address_line_2": "Apt 4B",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "94102",
    "email_address": "john@example.com",
    "phone_number": "5551234567",
    "relationship": "Son"
  },
  "deletedAt": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**User Fields:**

- Optional map of user-provided values
- Keys correspond to field IDs defined in `caseType.userFields`
- Updated via server action `updateCaseUserFields`
- Can be referenced in document templates alongside extracted fields

---

### cases/{caseId}/sourceDocuments/{docId}

```json
{
  "docId": "doc_xyz789abc",
  "caseId": "case_abc123xyz",
  "userId": "firebase_auth_uid",
  "sourceDocumentTypeId": "death_certificate_image",
  "isLatest": true,
  "latestExtractionId": "ext_abc123xyz",
  "status": "processed",
  "validityReason": null,
  "fileName": "death-cert.jpg",
  "storagePath": "cases/case_abc123xyz/attachments/doc_xyz789abc.jpg",
  "mimeType": "image/jpeg",
  "fileSizeBytes": 2458624,
  "uploadedAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Status values** (mirrored from `extractions/{id}.status`):

- `processing` - Extraction in progress
- `processed` - Extraction complete, all fields valid
- `invalid` - Wrong document type or illegible — `validityReason` is set
- `flagged` - Valid and legible but field-level validation errors
- `failed` - System or API exception

---

### extractions/{extractionId}

```json
{
  "extractionId": "ext_abc123xyz",
  "caseId": "case_abc123xyz",
  "userId": "firebase_auth_uid",
  "caseTypeId": "death_certificate_flow",
  "sourceDocumentTypeId": "death_certificate_image",
  "caseSourceDocumentId": "doc_xyz789abc",
  "version": 1,
  "status": "processed",
  "fields": {
    "deceased_name": {
      "value": "John Doe",
      "confidence": 0.98,
      "flagged": false,
      "flagReason": null
    },
    "date_of_death": {
      "value": "2024-01-15",
      "confidence": 0.72,
      "flagged": true,
      "flagReason": "Handwritten date partially illegible"
    }
  },
  "validationErrors": null,
  "extractionConfig": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "maxTokens": 4000,
    "promptVersion": "v1"
  },
  "durationMs": 12450,
  "errorMessage": null,
  "extractedAt": "timestamp",
  "createdAt": "timestamp"
}
```

**Status values:**

- `pending` - Queued
- `processing` - In progress
- `processed` - Complete, all fields valid
- `invalid` - Wrong document type or illegible — `validityReason` is set
- `flagged` - Valid and legible but field-level validation errors
- `failed` - System or API exception

**Validation errors format:**

```json
{
  "validationErrors": [
    {
      "rule": "date_order",
      "message": "Date of death cannot be before date of birth"
    }
  ]
}
```

---

### generations/{generationId}

```json
{
  "generationId": "gen_abc123xyz",
  "caseId": "case_abc123xyz",
  "userId": "firebase_auth_uid",
  "caseTypeId": "death_certificate_flow",
  "templateId": "social_security",
  "templateName": "Social Security Administration - Report of Death",
  "extractionId": "ext_abc123xyz",
  "extractionVersion": 1,
  "extractedFields": {
    "deceased_name": "John Doe",
    "ssn": "123-45-6789",
    "date_of_death": "2024-01-15",
    "date_of_birth": "1950-03-22",
    "place_of_death": "San Francisco, CA",
    "certificate_number": "2024-SF-00123",
    "issuing_authority": "San Francisco County Health Department"
  },
  "status": "completed",
  "outputPath": "cases/case_abc123xyz/outputs/gen_abc123xyz.pdf",
  "outputFileName": "Social_Security_Report.pdf",
  "errorMessage": null,
  "durationMs": 8750,
  "generatedAt": "timestamp",
  "createdAt": "timestamp"
}
```

**Status values:**

- `pending` - Queued
- `generating` - In progress
- `completed` - PDF ready
- `failed` - Generation error

---

## Relationships

**Case Type → Source Documents**

- One case type has many source document types (subcollection)
- Each source document type references fields from parent case type

**Case Type → Templates**

- One case type has many templates (subcollection)
- Each template can reference both extracted fields and user fields from parent case type
- `referenceFields`: References extracted data from source documents
- `referenceUserFields`: References user-provided information

**Case → Source Documents**

- One case has many source documents (subcollection, constrained to 1 for MVP)
- Each source document references a source document type config

**Case → Extractions**

- One case has many extractions (top-level collection)
- Latest extraction reference denormalized on case

**Case → Generations**

- One case has many generations (top-level collection)
- Each generation snapshots extracted fields used

**Extraction → Generation**

- One extraction can be used by many generations
- Generation stores extractionId + snapshot of fields

---

## Soft Deletion

**Cases:** Use `deletedAt` timestamp

- User-initiated deletion from UI
- Preserves audit trail and related data
- Query: `where('deletedAt', '==', null)`

**Configs (caseTypes, templates, sourceDocuments):** Use both `isActive` and `deletedAt`

- `isActive`: Template/config readiness (draft vs published)
- `deletedAt`: Soft deletion (removed from system)
- Query active: `where('isActive', '==', true).where('deletedAt', '==', null)`
- Rationale: Separates "ready to use" from "permanently removed"

---

## Timestamp Fields

All timestamp fields (`createdAt`, `updatedAt`, `deletedAt`) must use Firestore `serverTimestamp()`:

- Prevents client clock manipulation
- Consistent across all writes
- Atomic with document operations

```typescript
// Correct
await setDoc(doc, {
  ...data,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

// Wrong - never use client time
createdAt: new Date().toISOString();
```

---

## Validation Strategy

**Two-tier validation (Python runtime):**

1. **Field-level (JSON Schema):** Type checking, format validation, required fields
   - Defined in `caseType.jsonSchema`
   - Validated using `jsonschema` library in FastAPI workers
   - Executed before custom validations
2. **Cross-field (Custom):** Business logic, date ordering, calculated fields
   - Defined in `caseType.customValidations` (array of rule names)
   - Implementations in worker validation module
   - Executed in order (later rules may depend on earlier ones)

**Execution order:**

1. JSON Schema validates individual fields
2. Custom validators run sequentially
3. Results stored in `extraction.validationErrors`

---

## Query Patterns

**User queries:**

```javascript
// My cases
cases.where("userId", "==", uid).orderBy("createdAt", "desc");

// Latest source document for a case
sourceDocuments
  .where("caseId", "==", caseId)
  .where("isLatest", "==", true)
  .limit(1);

// Source document history
sourceDocuments.where("caseId", "==", caseId).orderBy("uploadedAt", "desc");

// My extractions for a case
extractions.where("caseId", "==", caseId).orderBy("version", "desc");

// My generations for a case
generations.where("caseId", "==", caseId).orderBy("createdAt", "desc");

// Latest extraction for case
extractions.where("caseId", "==", caseId).orderBy("version", "desc").limit(1);
```

**Admin queries (future):**

```javascript
// All extractions by case type
extractions.where("caseTypeId", "==", "death_certificate_flow");

// Low confidence extractions
extractions.where("fields.deceased_name.flagged", "==", true);

// Failed generations
generations.where("status", "==", "failed").orderBy("createdAt", "desc");

// User activity
cases.where("userId", "==", targetUid).orderBy("createdAt", "desc");

// Extractions by model
extractions.where("extractionConfig.model", "==", "gpt-4o");
```

---

## Denormalization Strategy

**Why denormalize:**

- Enable cross-user admin queries without joins
- Reduce reads for common access patterns
- Support analytics without complex aggregations

**Denormalized fields:**

- `userId` in all runtime collections (cases, extractions, generations)
- `caseTypeId` in extractions and generations
- `latestExtractionId` in sourceDocuments
- `status` and `validityReason` in sourceDocuments (mirrored from extractions)
- `templateName` in generations
- `extractedFields` snapshot in generations

**Trade-off:**

- Small storage cost
- Must maintain consistency in workers
- Eliminates need for collection group queries
