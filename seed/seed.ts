#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = process.cwd();
const envPath = path.join(PROJECT_ROOT, "apps", "web", ".env");

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`Error loading .env file: ${result.error}`);
    process.exit(1);
  }
} else {
  console.error(`Error: .env file not found at ${envPath}`);
  console.error(
    "Please create apps/web/.env with Firebase Admin SDK credentials:",
  );
  process.exit(1);
}

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.error(
    "Error: Missing required Firebase credentials in apps/web/.env",
  );
  console.error(
    "Required variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
  );
  process.exit(1);
}

const ALLOWED_COLLECTIONS = ["caseTypes"];
const MAX_FILE_SIZE_MB = 5;
const MAX_JSON_DEPTH = 10;
const SEED_DATA_ROOT = path.join(PROJECT_ROOT, "seed", "data", "caseType");

class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

function validatePath(filePath: string): void {
  const resolvedPath = path.resolve(filePath);
  const allowedRoot = path.resolve(SEED_DATA_ROOT);

  if (!resolvedPath.startsWith(allowedRoot)) {
    throw new SecurityError(
      `Path traversal detected: ${filePath} is outside seed/data/caseType/`,
    );
  }

  if (filePath.includes("..")) {
    throw new SecurityError(`Invalid path: contains '..' - ${filePath}`);
  }
}

function validateCollection(collection: string): void {
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    throw new SecurityError(
      `Collection '${collection}' not allowed. Only ${ALLOWED_COLLECTIONS.join(", ")} permitted.`,
    );
  }
}

function getJSONDepth(obj: any, currentDepth = 0): number {
  if (currentDepth > MAX_JSON_DEPTH) {
    return currentDepth;
  }

  if (typeof obj !== "object" || obj === null) {
    return currentDepth;
  }

  if (Array.isArray(obj)) {
    return Math.max(
      currentDepth,
      ...obj.map((item) => getJSONDepth(item, currentDepth + 1)),
    );
  }

  const depths = Object.values(obj).map((value) =>
    getJSONDepth(value, currentDepth + 1),
  );
  return Math.max(currentDepth, ...depths);
}

function validateJSON(filePath: string): any {
  validatePath(filePath);

  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new SecurityError(
      `File ${filePath} exceeds ${MAX_FILE_SIZE_MB}MB limit (${fileSizeMB.toFixed(2)}MB)`,
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let parsed: any;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error}`);
  }

  const depth = getJSONDepth(parsed);
  if (depth > MAX_JSON_DEPTH) {
    throw new SecurityError(
      `JSON nesting depth (${depth}) exceeds maximum (${MAX_JSON_DEPTH}) in ${filePath}`,
    );
  }

  return parsed;
}

function validateDocumentId(doc: any, expectedField: string): void {
  if (!doc[expectedField]) {
    const docKeys = Object.keys(doc).join(", ");
    throw new Error(
      `Document missing required ID field: ${expectedField}. Found fields: ${docKeys}`,
    );
  }

  const id = doc[expectedField];
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error(`Invalid ${expectedField}: must be a non-empty string`);
  }
}

interface SeedOperation {
  collection: string;
  docId: string;
  subcollection?: string;
  subdocId?: string;
  data: any;
  filePath: string;
}

interface SeedResult {
  operation: SeedOperation;
  success: boolean;
  error?: string;
  duration: number;
}

async function seedDocument(
  operation: SeedOperation,
  merge: boolean,
  adminDb: any,
  FieldValue: any,
): Promise<SeedResult> {
  const startTime = Date.now();

  try {
    validateCollection(operation.collection);

    let docRef;
    let docPath: string;

    if (operation.subcollection && operation.subdocId) {
      docRef = adminDb
        .collection(operation.collection)
        .doc(operation.docId)
        .collection(operation.subcollection)
        .doc(operation.subdocId);
      docPath = `${operation.collection}/${operation.docId}/${operation.subcollection}/${operation.subdocId}`;
    } else {
      docRef = adminDb.collection(operation.collection).doc(operation.docId);
      docPath = `${operation.collection}/${operation.docId}`;
    }

    const docSnapshot = await docRef.get();
    const exists = docSnapshot.exists;

    const data = { ...operation.data };

    if (exists) {
      data.updatedAt = FieldValue.serverTimestamp();
    } else {
      data.createdAt = FieldValue.serverTimestamp();
      data.updatedAt = FieldValue.serverTimestamp();
    }

    await docRef.set(data, { merge });

    const duration = Date.now() - startTime;
    console.log(
      `✓ ${exists ? "Updated" : "Created"} ${docPath} (${duration}ms)`,
    );

    return {
      operation,
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `✗ Failed ${operation.collection}/${operation.docId}: ${errorMessage}`,
    );

    return {
      operation,
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

function scanCaseTypes(): SeedOperation[] {
  const operations: SeedOperation[] = [];

  if (!fs.existsSync(SEED_DATA_ROOT)) {
    console.warn(`Seed data root not found: ${SEED_DATA_ROOT}`);
    return operations;
  }

  const caseTypeIds = fs.readdirSync(SEED_DATA_ROOT).filter((name) => {
    const fullPath = path.join(SEED_DATA_ROOT, name);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const caseTypeId of caseTypeIds) {
    const caseTypePath = path.join(SEED_DATA_ROOT, caseTypeId);

    const docJsonPath = path.join(caseTypePath, "doc.json");
    if (fs.existsSync(docJsonPath)) {
      try {
        const data = validateJSON(docJsonPath);
        validateDocumentId(data, "caseTypeId");

        operations.push({
          collection: "caseTypes",
          docId: data.caseTypeId,
          data,
          filePath: docJsonPath,
        });
      } catch (error) {
        console.error(
          `Error reading ${docJsonPath}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const sourceDocsPath = path.join(caseTypePath, "sourceDocuments");
    if (fs.existsSync(sourceDocsPath)) {
      const sourceDocFiles = fs
        .readdirSync(sourceDocsPath)
        .filter((name) => name.endsWith(".json"));

      for (const fileName of sourceDocFiles) {
        const filePath = path.join(sourceDocsPath, fileName);
        try {
          const data = validateJSON(filePath);
          validateDocumentId(data, "sourceDocumentTypeId");

          operations.push({
            collection: "caseTypes",
            docId: caseTypeId,
            subcollection: "sourceDocuments",
            subdocId: data.sourceDocumentTypeId,
            data,
            filePath,
          });
        } catch (error) {
          console.error(
            `Error reading ${filePath}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    const templatesPath = path.join(caseTypePath, "templates");
    if (fs.existsSync(templatesPath)) {
      const templateFiles = fs
        .readdirSync(templatesPath)
        .filter((name) => name.endsWith(".json"));

      for (const fileName of templateFiles) {
        const filePath = path.join(templatesPath, fileName);
        try {
          const data = validateJSON(filePath);
          validateDocumentId(data, "templateId");

          operations.push({
            collection: "caseTypes",
            docId: caseTypeId,
            subcollection: "templates",
            subdocId: data.templateId,
            data,
            filePath,
          });
        } catch (error) {
          console.error(
            `Error reading ${filePath}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }
  }

  return operations;
}

async function main() {
  const { adminDb } = await import("../apps/web/lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  console.log("=".repeat(60));
  console.log("🌱 CaseType Seeder");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const merge = !args.includes("--no-merge");

  console.log(`Mode: ${merge ? "MERGE" : "OVERWRITE"}`);
  console.log(`Data root: ${SEED_DATA_ROOT}`);
  console.log();

  console.log("Scanning for seed data...");
  const operations = scanCaseTypes();

  if (operations.length === 0) {
    console.log("No seed data found.");
    return;
  }

  console.log(`Found ${operations.length} operations to perform.`);
  console.log();

  console.log("Seeding documents...");
  const results: SeedResult[] = [];

  for (const operation of operations) {
    const result = await seedDocument(operation, merge, adminDb, FieldValue);
    results.push(result);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total operations: ${results.length}`);
  console.log(`✓ Successful: ${successful}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total time: ${totalTime}ms`);

  if (failed > 0) {
    console.log();
    console.log("Failed operations:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.operation.filePath}: ${r.error}`);
      });

    process.exit(1);
  }

  console.log();
  console.log("✓ Seeding completed successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
