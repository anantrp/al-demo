# User Flows

## 1. Create Case

**User Action:** Fill out case creation form with descriptive name

**System Flow:**

```
Next.js Server Action: createCase(name, caseTypeId)
  ↓
Firestore Write (Admin SDK):
  - Create case document
    - caseId: "case_{auto_id}"
    - status: "draft"
    - userId: from auth session
    - name: user input
    - deletedAt: null
  - Create user document if first case
  ↓
Return caseId to client
  ↓
Client: Navigate to /cases/{caseId}
  - Start onSnapshot listener on case document
  - Show upload section
```

**Why:** Case created immediately lets user see their work saved. Draft status indicates no processing yet.

---

## 2. Upload Source Document

**User Action:** Select image file (death certificate)

**System Flow:**

**Step 2a - Get Upload URL:**

```
Next.js Server Action: generateUploadUrl(caseId)
  ↓
Verify:
  - User owns case (userId match)
  - Case not deleted
  ↓
Generate:
  - docId: "doc_{auto_id}"
  - Storage path: "cases/{caseId}/attachments/{docId}.jpg"
  - Signed upload URL (5 min expiry)
  ↓
Return { uploadUrl, docId, storagePath }
```

**Step 2b - Client Upload:**

```
Client: PUT file to signed URL
  ↓
Firebase Storage: File saved
  ↓
Client: On success, call finalizeUpload()
```

**Step 2c - Finalize & Trigger Extraction:**

```
Next.js Server Action: finalizeUpload(caseId, docId, metadata)
  ↓
Firestore Writes (Admin SDK):
  1. Set all existing sourceDocuments isLatest: false
  2. Create new sourceDocument:
     - docId, storagePath, fileName, mimeType
     - isLatest: true
  3. Update case:
     - status: "open"
  ↓
FastAPI Call: POST /enqueue/extraction
  - payload: { caseId, sourceDocumentId }
  ↓
FastAPI /enqueue/extraction:
  - Create extraction document (status: pending)
  - Enqueue Cloud Task to /worker/extraction
  - Return { extractionId }
  ↓
Server Action completes
  ↓
Client onSnapshot fires:
  - Case status: "open" → show "Processing..."
```

**Why:** Signed URL lets client upload directly to Storage (fast, no server bottleneck). Server Action validates and triggers processing. onSnapshot gives real-time status without polling.

---

## 3. Extract Fields from Document

**System Flow (Async Worker):**

```
Cloud Tasks → POST /worker/extraction
  - Auth: API key verification
  - Payload: { extractionId }
  ↓
FastAPI Worker:
  1. Load extraction doc, get caseId + sourceDocumentId
  2. Load case, caseType, sourceDocument config
  3. Update extraction (status: "extracting")
  4. Update case (status: "extracting")
     ↓ onSnapshot fires → UI shows "Extracting fields..."

  5. Download image from Storage
  6. Call GPT-4 Vision:
     - Prompt built from caseType.fields
     - Returns structured { fields: {...} }

  7. Validate:
     - JSON Schema validation (field types, formats)
     - Custom validators (date ordering, SSN format)

  8. Determine status:
     - validationErrors? → "failed"
     - Otherwise → "extracted"

  9. Firestore Writes:
     - Update extraction:
       - fields, validationErrors
       - extractionConfig (model, temp, promptVersion)
       - status, extractedAt, durationMs
     - Update sourceDocument:
       - latestExtractionId: extraction.extractionId
     - Update case:
       - extractionStatus: extraction.status
       - status: "extracted" (if successful)
     ↓ onSnapshot fires → UI shows extracted fields
```

**User View:**

- Status changes: "Processing..." → "Extracting fields..." → "Extraction complete"
- See extracted fields with confidence scores
- Flagged fields highlighted (confidence < threshold)

**Why:** Worker runs async (upload doesn't block). Real-time updates show progress. Validation catches errors before generation.

---

## 4. Download Output Document

**User Action:** Click "Download" button on template card

**System Flow:**

```
Client: User clicks "Download Social Security Form"
  ↓
Get Firebase ID Token
  ↓
FastAPI Call: POST /documents/{caseId}/{templateId}/download
  - Headers: Authorization: Bearer {idToken}
  ↓
FastAPI /documents/{caseId}/{templateId}/download:
  1. Verify Firebase ID token
  2. Verify user owns case (userId match)
  3. Load template config:
     - Check template exists and is active
  4. Verify latest extraction exists and is processed
  5. Aggregate fields from latest extractions
  6. Get userFields from case document
  7. Prepare template context:
     - fields: { deceased_name: "...", ssn: "...", ... }
     - userFields: { full_name: "...", email: "...", ... }
     - system: { date: "December 15, 2024" }
  8. Download template .docx from Storage
  9. Render document using python-docxtpl:
     - Replace {{ fields.deceased_name }} etc with values
  10. Create generation audit record (Firestore):
      - generationId: "gen_{auto_id}"
      - status: "completed"
      - templateId, templateName
      - outputFileName, durationMs
      - createdAt, generatedAt
  11. Stream .docx file to client:
      - Content-Type: application/vnd.openxmlformats-...
      - Content-Disposition: attachment; filename="..."
  ↓
Client: Browser downloads file
  - Shows "Downloading..." during request
  - Browser triggers download with correct filename
```

**User View:**

- Click "Download" → Shows spinner
- Document generates in 1-3 seconds
- Browser downloads file automatically
- Can download again anytime (generates fresh with latest data)

**Why:** 
- Always uses latest case data (no stale documents)
- Fast for small .docx files (1-3 seconds)
- No Storage costs for outputs
- Simpler architecture (no async workers, no status tracking)
- Audit trail preserved in generations collection

---

## Real-Time Updates Summary

**Client onSnapshot listeners:**

- `/cases/{caseId}` - Status changes, extraction updates

**Why onSnapshot:**

- No polling
- Updates arrive 100-500ms after Firestore write
- Works offline (queued when reconnected)
- Automatic error handling and reconnection

**Status Progression:**

```
Case: draft → open → extracting → extracted
Extraction: pending → extracting → extracted
```

Each status change triggers UI update via onSnapshot.

**Document Downloads:**

- No real-time tracking needed
- Synchronous HTTP request with loading state
- Browser handles download automatically

---

## Error Handling

**Upload fails:**

- Client retries upload to same signed URL
- If URL expired, get new URL from Server Action

**Extraction fails:**

- Worker writes error to extraction.errorMessage
- Case status remains "extracting" (not auto-failed)
- User can re-upload to retry

**Download/Generation fails:**

- FastAPI returns HTTP error with detail message
- Client shows error toast to user
- Generation audit record created with status: "failed"
- User can click download again to retry

**Why:** Synchronous errors provide immediate feedback. Failed audit records preserved for debugging.
