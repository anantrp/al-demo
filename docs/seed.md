# CaseType Seeder

A local seeding system that syncs caseType configuration JSON files to Firestore with merge support and built-in security checks.

## Overview

This seeder allows you to define caseType configurations as JSON files and sync them to Firestore. It's designed to be run locally for configuration management and supports both merge and overwrite modes.

## Directory Structure

```
seed/
├── data/
│   └── caseType/
│       └── {caseTypeId}/
│           ├── doc.json                          # Main caseType document
│           ├── sourceDocuments/                  # Subcollection
│           │   └── {sourceDocumentTypeId}.json
│           └── templates/                        # Subcollection
│               └── {templateId}.json
└── seed.ts                                       # Main seeding script
```

## Usage

### Prerequisites

1. Ensure Firebase Admin SDK credentials are configured in `apps/web/.env`:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   
   **Important**: The seed script automatically loads environment variables from `apps/web/.env`. Make sure this file exists and contains valid Firebase Admin SDK credentials.

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

### Running the Seeder

**Default mode (merge)** - Preserves existing fields not in JSON:
```bash
npm run seed
```

**Overwrite mode** - Replaces entire documents:
```bash
npm run seed -- --no-merge
```

**Direct execution:**
```bash
npx tsx seed/seed.ts
npx tsx seed/seed.ts --no-merge
```

## Features

### Security & Safety

- **Collection Whitelist**: Only allows writes to `caseTypes` collection
- **Path Validation**: Prevents path traversal attacks
- **JSON Safety**: 5MB file size limit and 10-level nesting depth limit
- **Build Isolation**: Excluded from Next.js builds to prevent credential leakage

### Timestamp Management

- `createdAt`: Only set when document doesn't exist (preserves original creation time)
- `updatedAt`: Always set on every write using Firestore serverTimestamp()

### Error Handling

- Continues on individual failures
- Reports detailed summary at end
- Exit code 1 if any failures occurred

## Example Data

See `seed/data/caseType/death_certificate_flow/` for example configurations:

- `doc.json` - Main caseType with field definitions and validation rules
- `sourceDocuments/death_certificate_image.json` - Source document type config
- `templates/social_security.json` - Template configuration

## Adding New Configurations

1. Create a new folder under `seed/data/caseType/{caseTypeId}/`
2. Add `doc.json` with the main caseType configuration
3. Optionally add subcollections:
   - `sourceDocuments/{sourceDocumentTypeId}.json`
   - `templates/{templateId}.json`
4. Run `npm run seed` to sync to Firestore

## JSON File Format

### Main Document (doc.json)

```json
{
  "caseTypeId": "your_case_type_id",
  "name": "Display Name",
  "description": "Description of the case type",
  "fields": { ... },
  "customValidations": [...],
  "isActive": true,
  "deletedAt": null
}
```

### Source Document (sourceDocuments/{id}.json)

```json
{
  "sourceDocumentTypeId": "document_type_id",
  "name": "Document Type Name",
  "description": "Description",
  "extractsFields": [...],
  "acceptedMimeTypes": [...],
  "maxFileSizeMB": 10,
  "isActive": true,
  "deletedAt": null
}
```

### Template (templates/{id}.json)

```json
{
  "templateId": "template_id",
  "name": "Template Name",
  "description": "Description",
  "referenceFields": [...],
  "storagePath": "path/to/template.docx",
  "version": "1.0.0",
  "isActive": true,
  "deletedAt": null
}
```

**Note**: Do not include `createdAt` or `updatedAt` fields in JSON files - these are auto-injected by the seeder.

## Troubleshooting

### "SecurityError: Collection not allowed"
The seeder only allows writes to the `caseTypes` collection. Verify your JSON files are correctly structured.

### "Path traversal detected"
All JSON files must be under `seed/data/caseType/`. Do not use `..` in paths.

### "File exceeds 5MB limit"
JSON files must be under 5MB. Consider splitting large configurations.

### "JSON nesting depth exceeds maximum"
JSON files must have a nesting depth of 10 levels or less.

## Security Considerations

- This seeder uses Firebase Admin SDK with full database access
- Run only locally, never expose in production environment
- Seed data is committed to the repository (contains only non-sensitive config data)
- Do not include user data, credentials, or API keys in JSON files
