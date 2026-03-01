# Project - Product Specification

## Overview

Project automates document intelligence workflows: extract structured data from uploaded documents, validate for accuracy, and generate institution-ready output documents. The MVP focuses on death certificate processing to demonstrate the full pipeline with real-world utility.

**Target Users:** Individuals handling post-death administrative tasks  
**Core Value:** Convert a single death certificate image into multiple pre-filled administrative letters in under 2 minutes

---

## Nomenclature

| Term                 | Definition                                                                        |
| -------------------- | --------------------------------------------------------------------------------- |
| **Case**             | A single processing request containing source documents and generated outputs     |
| **Case Type**        | Configuration defining which documents are required and which outputs to generate |
| **Source Document**  | User-uploaded file (image or PDF) to be processed                                 |
| **Extraction**       | Structured data pulled from source documents with confidence scores               |
| **Template**         | Reusable Word document defining an output document structure                      |
| **Generation**       | Process of creating a filled PDF from a template                                  |
| **Confidence Score** | 0.0-1.0 rating of extraction accuracy per field                                   |

---

## MVP Scope

### Case Type: Death Certificate Flow

**Source Document:** Death certificate image (JPG/PNG)

**Extracted Fields:**

- Deceased name, SSN, dates (birth/death)
- Age at death, cause, place
- Issuing authority, certificate number

**Generated Documents:**

- Social Security Administration notification
- Financial institution notification letter

### Core Features

**1. Case Management**

- Create case with descriptive name
- Upload death certificate image
- View real-time extraction progress
- See extracted fields with confidence scores

**2. Document Extraction**

- GPT-4 Vision automated extraction
- Field-level confidence scoring
- Validation (date ordering, age consistency, format checks)
- Auto-approval at 85%+ confidence threshold

**3. Document Generation**

- Manual trigger per template
- Live generation progress
- Download PDFs with signed URLs
- Multiple generations per case (retry-friendly)

**4. Data Versioning**

- Multiple extractions per case (prompt tuning)
- Upload history (latest flagged, previous preserved)
- Immutable generations (re-extraction doesn't break PDFs)

---

## User Stories

### Primary Flow

**As a user handling a death certificate**, I want to:

1. Sign in with Google
2. Create a case ("Mom's death certificate")
3. Upload the certificate image
4. See extraction progress in real-time
5. Review extracted fields (9 fields, confidence scores shown)
6. Click "Generate" on Social Security template
7. Download pre-filled PDF letter

**Time to completion:** < 2 minutes from upload to download

### Edge Cases Handled

**Low confidence field:**

- Field flagged at 72% confidence
- User sees highlighted warning
- Can still generate with warning acknowledged
- Re-extraction available (future: manual correction)

**Re-upload:**

- User uploads better quality scan
- Previous extraction preserved in history
- New extraction triggered automatically

**Multiple generations:**

- Generate Social Security letter
- Later generate financial institution letter
- Both PDFs preserved independently

---

## Technical Constraints (MVP)

- **Single case type:** Death certificate flow only
- **Single source document:** One image per case (schema supports multiple)
- **Image only:** JPG/PNG accepted (PDF support future)
- **No admin panel:** Firestore Console for config management
- **No manual correction:** Re-upload for better accuracy
- **No batch processing:** One case at a time

---

## Future Roadmap

### Phase 2: Admin & Quality

**Admin Panel**

- Review queue for flagged extractions
- Manual field correction interface
- Accuracy monitoring dashboard

**Retry & Recovery**

- Manual re-extraction trigger (prompt changes)
- Regenerate specific templates
- Bulk re-processing

**Quality Improvements**

- Fine-tuned model on correction data
- Confidence threshold tuning per field
- Custom validation rules editor
