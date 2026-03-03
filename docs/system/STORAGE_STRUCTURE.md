# Firebase Storage Structure

## Storage Paths

```
templates/
  {caseTypeId}/
    {templateId}.docx

cases/
  {caseId}/
    attachments/
      {docId}.{ext}
```

**Example:**

```
templates/
  death_certificate_flow/
    social_security.docx
    financial_institution.docx

cases/
  case_abc123xyz/
    attachments/
      doc_xyz789abc.jpg
      doc_def456ghi.jpg
```

**Note:** Generated documents (outputs) are not stored in Firebase Storage. They are generated on-the-fly and streamed directly to users on download.

## ID Mapping

All IDs correspond to Firestore document IDs for easy debugging and guaranteed uniqueness:

- `{templateId}` → `caseTypes/{caseTypeId}/templates/{templateId}`
- `{docId}` → `cases/{caseId}/sourceDocuments/{docId}`

Storage paths are stored in Firestore documents. No code constructs paths manually.

**Why include IDs in file names:**

- **Debugging:** See `gen_abc123.docx` in Storage Console → instantly know which Firestore document
- **Uniqueness:** Firestore IDs are guaranteed unique, prevents collisions
- **Traceability:** Direct mapping between Storage files and database records without lookups
- **No downside:** IDs are generated anyway, using them costs nothing

## Access Patterns

**All operations use Admin SDK - no public access:**

| Operation              | Method           | Who                                                   |
| ---------------------- | ---------------- | ----------------------------------------------------- |
| Upload template          | Admin SDK  | Manual seeding / future admin panel         |
| Upload source document   | Admin SDK  | Next.js Server Action                        |
| Download attachment      | Client SDK | Authenticated user who owns the case         |
| Generate document        | FastAPI    | Streamed directly to user (not stored)       |

## Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /cases/{caseId}/attachments/{allPaths=**} {
      allow read: if request.auth != null &&
        firestore.get(/databases/(default)/documents/cases/$(caseId)).data.userId == request.auth.uid;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Access rules:**

- Attachments (`cases/{caseId}/attachments/`): readable by the authenticated user who owns the case, verified via Firestore lookup
- All other paths (templates): deny all — uploads use Admin SDK
- No writes via client SDK anywhere

## Download Flow

**Attachments (Client SDK):**

```
User requests file
  ↓
Client SDK: getDownloadURL(storageRef)
  ↓
Storage Rules: Verify case ownership via Firestore
  ↓
Return download URL
  ↓
Browser downloads directly
```

**Generated Documents (FastAPI):**

```
User clicks download
  ↓
Client: POST /documents/{caseId}/{templateId}/download
  ↓
FastAPI: Verify auth, generate document on-the-fly
  ↓
Stream .docx file directly to browser
  ↓
Browser downloads file
```

**Benefits:**
- Attachments: No Server Action required, Storage rules provide security
- Generated documents: Always fresh with latest data, no Storage costs

## File Metadata Storage

**Firestore references (not Storage metadata):**

Templates:

```json
{
  "storagePath": "templates/death_certificate_flow/social_security.docx"
}
```

Source Documents:

```json
{
  "storagePath": "cases/case_abc123xyz/attachments/doc_xyz789abc.jpg",
  "fileName": "death-cert.jpg",
  "mimeType": "image/jpeg",
  "fileSizeBytes": 2458624
}
```

Generations (audit records only, files not stored):

```json
{
  "outputFileName": "Social_Security_Report.docx",
  "status": "completed",
  "durationMs": 8750
}
```

## Cleanup Considerations

**Not implemented in MVP, future considerations:**

- Delete old source documents when `isLatest` becomes false
- Template versioning cleanup strategy
- Storage cost monitoring and lifecycle policies

**Note:** Generated documents are not stored, so no cleanup is needed for outputs.
