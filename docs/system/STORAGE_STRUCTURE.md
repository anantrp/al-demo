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
    outputs/
      {generationId}.pdf
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
    outputs/
      gen_mno123pqr.pdf
      gen_stu456vwx.pdf
```

## ID Mapping

All IDs correspond to Firestore document IDs for easy debugging and guaranteed uniqueness:

- `{templateId}` → `caseTypes/{caseTypeId}/templates/{templateId}`
- `{docId}` → `cases/{caseId}/sourceDocuments/{docId}`
- `{generationId}` → `generations/{generationId}`

Storage paths are stored in Firestore documents. No code constructs paths manually.

**Why include IDs in file names:**

- **Debugging:** See `gen_abc123.pdf` in Storage Console → instantly know which Firestore document
- **Uniqueness:** Firestore IDs are guaranteed unique, prevents collisions
- **Traceability:** Direct mapping between Storage files and database records without lookups
- **No downside:** IDs are generated anyway, using them costs nothing

## Access Patterns

**All operations use Admin SDK or signed URLs - no public access:**

| Operation              | Method           | Who                                                   |
| ---------------------- | ---------------- | ----------------------------------------------------- |
| Upload template        | Admin SDK        | Manual seeding / future admin panel                   |
| Upload source document | Admin SDK        | Next.js Server Action                                 |
| Upload generated PDF   | Admin SDK        | FastAPI worker                                        |
| Download attachment    | Client SDK       | Authenticated user who owns the case                  |
| Download other files   | Signed URL       | Next.js Server Action generates URL, client downloads |

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
- All other paths (templates, outputs): deny all — uploads use Admin SDK, downloads use signed URLs
- No writes via client SDK anywhere

## Download Flow

```
User requests file
  ↓
Next.js Server Action
  ↓
Verify user owns case (Firestore read)
  ↓
Admin SDK generates signed URL (5 min expiry)
  ↓
Return URL to client
  ↓
Client downloads directly from Storage
```

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

Generations:

```json
{
  "outputPath": "cases/case_abc123xyz/outputs/gen_mno123pqr.pdf",
  "outputFileName": "Social_Security_Report.pdf"
}
```

## Cleanup Considerations

**Not implemented in MVP, future considerations:**

- Delete old source documents when `isLatest` becomes false
- Delete generation PDFs when case deleted
- Template versioning cleanup strategy
- Storage cost monitoring and lifecycle policies
