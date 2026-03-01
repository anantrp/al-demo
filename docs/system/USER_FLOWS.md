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
  4. Update case (status: "extracting", latestExtractionId)
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

## 4. Generate Output Document

**User Action:** Click "Generate" button on template card

**System Flow:**

```
Next.js Server Action: generateDocument(caseId, templateId)
  ↓
Verify:
  - User owns case
  - Latest extraction status is "extracted"
  - Template exists, is active, and not deleted
  ↓
FastAPI Call: POST /enqueue/generation
  - payload: { caseId, templateId, extractionId }
  ↓
FastAPI /enqueue/generation:
  1. Load extraction, template
  2. Snapshot extracted fields template needs
  3. Create generation document:
     - generationId: "gen_{auto_id}"
     - status: "pending"
     - extractedFields: { deceased_name: "...", ... }
  4. Enqueue Cloud Task to /worker/generation
  5. Return { generationId }
  ↓
Server Action returns
  ↓
Client onSnapshot: Generation doc appears
  - Status: "pending"
  - Template name shown
  - "Generating..." indicator
```

**Why:** User initiates generation explicitly (control when PDFs are created). Snapshot prevents re-extraction from breaking existing documents. onSnapshot shows progress.

---

## 5. Generate PDF

**System Flow (Async Worker):**

```
Cloud Tasks → POST /worker/generation
  - Auth: API key verification
  - Payload: { generationId }
  ↓
FastAPI Worker:
  1. Load generation doc (has snapshotted fields)
  2. Update generation (status: "generating")
     ↓ onSnapshot fires → UI shows "Generating PDF..."

  3. Download template .docx from Storage
  4. Render template:
     - Replace {{ deceased_name }} etc with values
     - python-docxtpl (Jinja2 in .docx)

  5. Convert .docx → PDF (LibreOffice headless)

  6. Upload PDF to Storage:
     - Path: "cases/{caseId}/outputs/{generationId}.pdf"

  7. Update generation:
     - status: "completed"
     - outputPath, outputFileName
     - generatedAt, durationMs
     ↓ onSnapshot fires → Download link appears
```

**User View:**

- Status: "Generating PDF..." → "Ready to download"
- Download button enabled
- Template name + timestamp shown

**Why:** Template rendering isolated in worker. PDF stored with generationId (multiple generations = multiple PDFs preserved).

---

## 6. Download Generated PDF

**User Action:** Click download button

**System Flow:**

```
Next.js Server Action: getDownloadUrl(generationId)
  ↓
Verify:
  - User owns generation (userId match)
  - Generation status is "completed"
  ↓
Generate signed URL:
  - Storage path from generation.outputPath
  - 5 min expiry
  ↓
Return { downloadUrl, fileName }
  ↓
Client: window.open(downloadUrl)
  - Direct download from Firebase Storage
  - Browser handles download
```

**Why:** Signed URL bypasses Storage rules securely. Short expiry prevents link sharing. Direct download (no proxy through server).

---

## Real-Time Updates Summary

**Client onSnapshot listeners:**

- `/cases/{caseId}` - Status changes, extraction updates
- `/generations` (where caseId == X) - Generation progress

**Why onSnapshot:**

- No polling
- Updates arrive 100-500ms after Firestore write
- Works offline (queued when reconnected)
- Automatic error handling and reconnection

**Status Progression:**

```
Case: draft → open → extracting → extracted
Extraction: pending → extracting → extracted
Generation: pending → generating → completed
```

Each status change triggers UI update via onSnapshot.

---

## Error Handling

**Upload fails:**

- Client retries upload to same signed URL
- If URL expired, get new URL from Server Action

**Extraction fails:**

- Worker writes error to extraction.errorMessage
- Case status remains "extracting" (not auto-failed)
- User can re-upload to retry

**Generation fails:**

- Worker writes error to generation.errorMessage
- Status: "failed"
- User can click generate again (creates new generation doc)

**Why:** Async errors don't block user. Each generation is independent (retry doesn't overwrite failed attempt).
