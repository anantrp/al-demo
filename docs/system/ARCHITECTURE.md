# System Architecture

## System Overview

```mermaid
graph TB
    subgraph client[Next.js - Vercel]
        UI[React Components]
        ClientSDK[Firebase Client SDK]
        ServerActions[Server Actions]
        AdminSDK[Firebase Admin SDK]
    end

    subgraph firebase[Firebase]
        Auth[Authentication]
        Firestore[(Firestore)]
        Storage[(Storage)]
        Rules[Security Rules]
    end

    subgraph workers[FastAPI - Cloud Run]
        EnqueueExtract[/enqueue/extraction]
        EnqueueGenerate[/enqueue/generation]
        ExtractWorker[/worker/extraction]
        GenerateWorker[/worker/generation]
        WorkerAdmin[Admin SDK]
    end

    subgraph infrastructure[Cloud Infrastructure]
        CloudTasks[Cloud Tasks]
    end

    UI -->|Sign in| Auth
    UI -->|Real-time listeners| ClientSDK
    ClientSDK -->|Read cases/status| Firestore

    UI -->|Create case, upload| ServerActions
    ServerActions -->|Validate, rate limit| AdminSDK
    AdminSDK -->|Write case| Firestore
    AdminSDK -->|Upload file| Storage

    ServerActions -->|POST /enqueue/extraction| EnqueueExtract
    ServerActions -->|POST /enqueue/generation| EnqueueGenerate

    EnqueueExtract -->|Create doc, enqueue| CloudTasks
    EnqueueGenerate -->|Create doc, enqueue| CloudTasks

    CloudTasks -->|API Key auth| ExtractWorker
    CloudTasks -->|API Key auth| GenerateWorker

    ExtractWorker -->|Update status| WorkerAdmin
    GenerateWorker -->|Update status| WorkerAdmin

    WorkerAdmin -->|Bypass rules| Firestore
    WorkerAdmin -->|Upload PDFs| Storage

    Firestore -.->|Real-time events| ClientSDK

    style ServerActions fill:#bbf
    style EnqueueExtract fill:#fbb
    style EnqueueGenerate fill:#fbb
    style ExtractWorker fill:#f99
    style GenerateWorker fill:#f99
```

## Component Responsibilities

### Next.js (Vercel)

**Client Components:**

- Firebase Auth (sign-in, sign-out, session management)
- Real-time listeners (`onSnapshot`) for case status and generation progress
- UI rendering (shadcn/ui components)
- Direct file uploads to Storage via signed URLs

**Server Actions (Firebase Admin SDK):**

- Case creation with validation and rate limiting
- Generate signed upload URLs for Storage
- Finalize uploads (create sourceDocument, trigger extraction)
- Trigger document generation (user-initiated)
- Generate signed download URLs
- Audit logging

### Firebase

**Authentication:** Google OAuth  
**Firestore:** Case metadata, extraction results, generation status, config collections  
**Storage:** Source documents, generated PDFs, templates  
**Security Rules:** Read-only for authenticated users (filtered by userId), all writes blocked

### FastAPI Workers (Cloud Run)

**Enqueue Endpoints:**

- `POST /enqueue/extraction` - Create extraction doc, enqueue Cloud Task, return extractionId
- `POST /enqueue/generation` - Create generation doc, enqueue Cloud Task, return generationId
- Called by Next.js Server Actions
- Return immediately (non-blocking)

**Worker Endpoints:**

- `POST /worker/extraction` - Download file, GPT-4 Vision extraction, validation, Firestore update
- `POST /worker/generation` - Template rendering, .docx → PDF conversion, Storage upload
- Called by Cloud Tasks (API key auth)
- Process async, update Firestore

**Admin SDK:** All Firestore/Storage writes bypass Security Rules

### Cloud Tasks

- Queue extraction jobs (automatic after upload)
- Queue generation jobs (user-initiated)
- API key authentication to FastAPI workers
- Automatic retries, rate limiting, durability

---

## Architecture Principles

### Separation of Concerns

**Client SDK for reads, Admin SDK for writes**

- Next.js Client SDK: Real-time listeners (`onSnapshot`), config reads
- Admin SDK: All writes (Server Actions + FastAPI workers)
- Rationale: Validation, rate limiting, audit trails happen server-side. Client cannot corrupt state.

**FastAPI for compute only**

- No business logic in FastAPI routes
- Workers process async tasks, update Firestore
- Enqueue endpoints create tracking docs, return IDs immediately
- Rationale: Separates heavy processing from request/response cycle

### Data Architecture

**Top-level collections enable admin queries**

- Runtime data: `cases`, `extractions`, `generations` (top-level)
- Config data: `caseTypes` with subcollections (`sourceDocuments`, `templates`)
- Rationale: Query "all extractions by case type" without collection group queries. Denormalized `userId` enables cross-user admin panel queries.

**Subcollections only when never queried across parents**

- `cases/{caseId}/sourceDocuments` - always case-scoped
- Never need "all source documents across cases"
- Rationale: Keeps related data together without polluting top-level query space

**Denormalization for performance**

- `userId`, `caseTypeId` in extractions/generations
- `latestExtractionId` on sourceDocument
- Rationale: Eliminates joins, enables direct filtering, supports analytics

### Security Model

**Defense in depth**

- Firestore Rules: Block client writes, filter reads by `userId`
- Storage Rules: Deny all (Admin SDK + signed URLs only)
- Worker Auth: API keys in Secret Manager
- Rationale: Multiple layers, client cannot bypass validation

**Single source of truth**

- Firestore paths stored in documents, never constructed manually
- IDs in filenames for debugging, not for logic
- Rationale: Reduces coupling, easier to refactor paths

### Async Processing

**Cloud Tasks for durability**

- Extraction: automatic (triggered after upload finalization)
- Generation: user-initiated (manual trigger per template)
- Rationale: Retries, rate limiting, survives instance restarts. Production-grade without over-engineering user-facing actions.

**Real-time updates via Firestore**

- Workers update Firestore, `onSnapshot` updates UI
- No polling, no WebSockets
- Rationale: Firebase native pattern, offline support, automatic reconnection

### Validation Strategy

**Two-tier validation (Python runtime)**

- JSON Schema: field-level (type, format, required)
- Custom validators: cross-field (date ordering, calculated values)
- Rationale: Declarative for simple cases, flexible for business logic

### Versioning & History

**Source documents: `isLatest` flag**

- New upload sets previous `isLatest: false`
- Preserves audit trail
- Rationale: Re-upload doesn't lose history, simple query for active doc

**Extractions: version number**

- Multiple extractions per case (prompt iterations)
- `version` increments, `extractionConfig` tracks parameters
- Rationale: Development needs re-extraction, production needs prompt evolution

**Generations: snapshot fields**

- Store `extractedFields` used for generation
- Re-extraction doesn't break existing PDFs
- Rationale: Immutable outputs, audit trail for compliance

**Templates: overwrite + version field**

- Simple path, version tracked in Firestore
- Rationale: No version sprawl in Storage, migrations handled by version field

### Soft Deletion

**Cases: `deletedAt` timestamp**

- User-driven, preserves data
- Rationale: Audit requirements, potential recovery

**Configs: `isActive` + `deletedAt`**

- `isActive`: Draft vs published, enabled vs disabled
- `deletedAt`: Soft deletion
- Rationale: Separates readiness from removal

### Timestamp Integrity

**Always use `serverTimestamp()`**

- Never trust client clock
- Rationale: Security (prevents backdating), consistency (timezone-agnostic)

---

## Technology Stack

| Layer      | Technology                                 | Hosting      |
| ---------- | ------------------------------------------ | ------------ |
| Frontend   | Next.js 15, React, shadcn/ui, Tailwind CSS | Vercel       |
| Backend    | FastAPI, Python 3.11                       | Cloud Run    |
| Database   | Firestore                                  | Firebase     |
| Storage    | Firebase Storage                           | Firebase     |
| Auth       | Firebase Authentication                    | Firebase     |
| Compute    | Cloud Tasks                                | GCP          |
| AI         | OpenAI GPT-4 Vision                        | —            |
| Deployment | Git-connected                              | Vercel + GCP |

---

## Data Flow Examples

### Case Creation + Upload

```
1. User fills case creation form (name)
   ↓
2. Server Action: createCase()
   - Firestore: Create case (status: draft, deletedAt: null)
   - Return caseId
   ↓
3. Client navigates to /cases/{caseId}
   - onSnapshot listener on case document
   ↓
4. User selects file
   ↓
5. Server Action: generateUploadUrl()
   - Generate docId, signed URL
   - Return to client
   ↓
6. Client: PUT file to Storage
   ↓
7. Server Action: finalizeUpload()
   - Create sourceDocument (isLatest: true)
   - Update case (status: open)
   - POST /enqueue/extraction
   ↓
8. FastAPI: Create extraction doc, enqueue Cloud Task
   ↓
9. Client onSnapshot: Status → "extracting"
```

### Extraction Processing

```
1. Cloud Tasks → POST /worker/extraction (API key auth)
   ↓
2. Worker:
   - Update extraction (status: extracting)
   - Download file from Storage
   - GPT-4 Vision extraction
   - JSON Schema + custom validation
   - Update extraction (fields, status: extracted)
   - Update sourceDocument (latestExtractionId)
   - Update case (status: extracted)
   ↓
3. Client onSnapshot: Extraction complete, display fields
```

### Document Generation

```
1. User clicks "Generate" on template
   ↓
2. Server Action: generateDocument()
   - Verify extraction complete
   - POST /enqueue/generation
   ↓
3. FastAPI: Create generation doc (snapshot fields), enqueue Cloud Task
   ↓
4. Client onSnapshot: Generation status → "generating"
   ↓
5. Cloud Tasks → POST /worker/generation
   ↓
6. Worker:
   - Fetch template .docx
   - Render with snapshotted fields
   - Convert .docx → PDF
   - Upload to Storage
   - Update generation (status: completed, outputPath)
   ↓
7. Client onSnapshot: Download link appears
```

### Download Flow

```
1. User clicks download
   ↓
2. Server Action: getDownloadUrl()
   - Verify user owns generation
   - Generate signed URL (5 min expiry)
   - Return URL
   ↓
3. Client: Direct download from Storage
```

---

## Security Model

**Firestore Rules:**

- Config collections: Read by authenticated users
- User data: Read own only (`userId` match)
- All writes: Blocked (Admin SDK only)

**Storage Rules:**

- All access denied
- Uploads: Admin SDK via Server Actions
- Downloads: Signed URLs via Server Actions

**Worker Authentication:**

- API keys stored in Secret Manager
- Cloud Tasks attaches key in `X-API-Key` header
- FastAPI verifies before processing

**Admin SDK Operations:**

- Bypass all Security Rules
- Used in Server Actions and FastAPI workers
- Trusted, already validated

---

## Non-Goals (MVP)

- Admin panel (manual Firestore Console)
- Retry endpoints (re-upload for recovery)
- Multi-document cases (schema ready, enforced to 1)
- Organization support (schema ready, null for now)

## Future-Proofing

Schema designed for:

- Admin cross-user queries (denormalized fields)
- Multi-document per case (subcollection + `isLatest`)
- Organization multi-tenancy (`organizationId` null)
- Template variations (reference fields, not hard requirements)
- Prompt evolution (versioned extractions)
