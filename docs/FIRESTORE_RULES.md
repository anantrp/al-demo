# Firestore Security Rules

## Access Pattern

**Client SDK (Next.js):**

- Read config collections (caseTypes, templates, sourceDocuments configs)
- Read user-owned data (cases, extractions, generations)
- All writes blocked

**Admin SDK (Next.js Server Actions + FastAPI):**

- All writes
- Bypasses security rules

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if isAuthenticated() && isOwner(userId);
      allow write: if false;
    }

    match /caseTypes/{caseTypeId} {
      allow read: if isAuthenticated();
      allow write: if false;

      match /sourceDocuments/{sourceDocTypeId} {
        allow read: if isAuthenticated();
        allow write: if false;
      }

      match /templates/{templateId} {
        allow read: if isAuthenticated();
        allow write: if false;
      }
    }

    match /cases/{caseId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow write: if false;

      match /sourceDocuments/{docId} {
        allow read: if isAuthenticated() && isOwner(resource.data.userId);
        allow write: if false;
      }
    }

    match /extractions/{extractionId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow write: if false;
    }

    match /generations/{generationId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow write: if false;
    }
  }
}
```

## Rationale

**All writes denied:**

- Server Actions validate, rate-limit, audit before writes
- Workers update processing status atomically
- No client-side state corruption
- Admin SDK bypasses rules for trusted operations

**Config collections (caseTypes):**

- Public to authenticated users
- Needed for form rendering, validation display
- Immutable for users

**User data (cases, extractions, generations):**

- Read own data only (`userId` match)
- Real-time listeners for status updates
- Cannot see other users' data

**Denormalized userId:**

- Every top-level document stores userId
- Single rule check, no Firestore lookups in rules
- Enables future admin queries without security changes

## Future Considerations

**Admin role (when admin panel added):**

```javascript
function isAdmin() {
  return request.auth.token.role == 'admin';
}

match /cases/{caseId} {
  allow read: if isAuthenticated() && (
    isOwner(resource.data.userId) || isAdmin()
  );
}
```

**Organization support (if multi-tenant):**

```javascript
function belongsToOrg(orgId) {
  return orgId != null &&
    request.auth.token.organizationId == orgId;
}

match /cases/{caseId} {
  allow read: if isAuthenticated() && (
    isOwner(resource.data.userId) ||
    belongsToOrg(resource.data.organizationId)
  );
}
```
