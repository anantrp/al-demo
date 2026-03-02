"use server";

import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { verifySession } from "./auth";
import { FieldValue } from "firebase-admin/firestore";
import { enqueueExtraction } from "@/lib/enqueue-api";
import { randomBytes } from "crypto";

const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000;

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

export interface GetUploadUrlResult {
  success: boolean;
  uploadUrl?: string;
  docId?: string;
  storagePath?: string;
  error?: string;
}

export async function getUploadUrl(
  caseId: string,
  sourceDocumentTypeId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number
): Promise<GetUploadUrlResult> {
  try {
    const user = await verifySession();
    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const caseRef = adminDb.collection("cases").doc(caseId);
    const caseDoc = await caseRef.get();
    if (!caseDoc.exists) {
      return { success: false, error: "Case not found" };
    }
    const caseData = caseDoc.data();
    if (caseData?.userId !== user.uid) {
      return { success: false, error: "Unauthorized" };
    }

    const caseTypeId = caseData?.caseTypeId as string;
    if (!caseTypeId) {
      return { success: false, error: "Invalid case" };
    }

    const sourceDocRef = adminDb
      .collection("caseTypes")
      .doc(caseTypeId)
      .collection("sourceDocuments")
      .doc(sourceDocumentTypeId);
    const sourceDoc = await sourceDocRef.get();
    if (!sourceDoc.exists) {
      return { success: false, error: "Source document type not found" };
    }
    const sourceDocData = sourceDoc.data();
    const acceptedMimeTypes = (sourceDocData?.acceptedMimeTypes ?? []) as string[];
    const maxFileSizeMB = (sourceDocData?.maxFileSizeMB ?? 10) as number;

    if (!acceptedMimeTypes.includes(mimeType)) {
      return {
        success: false,
        error: `File type not accepted. Allowed: ${acceptedMimeTypes.join(", ")}`,
      };
    }
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (fileSizeBytes > maxBytes) {
      return {
        success: false,
        error: `File too large. Maximum size: ${maxFileSizeMB}MB`,
      };
    }

    const docId = `doc_${randomBytes(12).toString("base64url")}`;
    const ext = getExtensionFromMime(mimeType);
    const storagePath = `cases/${caseId}/attachments/${docId}.${ext}`;

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return {
        success: false,
        error: "Storage is not configured (FIREBASE_STORAGE_BUCKET)",
      };
    }
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + SIGNED_URL_EXPIRY_MS,
      contentType: mimeType,
    });

    return {
      success: true,
      uploadUrl,
      docId,
      storagePath,
    };
  } catch (error) {
    console.error("Error getting upload URL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get upload URL",
    };
  }
}

export interface FinalizeUploadResult {
  success: boolean;
  error?: string;
}

export async function finalizeUpload(
  caseId: string,
  docId: string,
  sourceDocumentTypeId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
  storagePath: string,
  idToken: string
): Promise<FinalizeUploadResult> {
  try {
    const user = await verifySession();
    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const caseRef = adminDb.collection("cases").doc(caseId);
    const caseDoc = await caseRef.get();
    if (!caseDoc.exists) {
      return { success: false, error: "Case not found" };
    }
    const caseData = caseDoc.data();
    if (caseData?.userId !== user.uid) {
      return { success: false, error: "Unauthorized" };
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return {
        success: false,
        error: "Storage is not configured (FIREBASE_STORAGE_BUCKET)",
      };
    }
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return {
        success: false,
        error: "Something went wrong, please upload again.",
      };
    }

    const sourceDocsRef = adminDb.collection("cases").doc(caseId).collection("sourceDocuments");
    const existingDocs = await sourceDocsRef
      .where("sourceDocumentTypeId", "==", sourceDocumentTypeId)
      .get();

    const batch = adminDb.batch();
    for (const doc of existingDocs.docs) {
      batch.update(doc.ref, { isLatest: false });
    }

    const newDocRef = sourceDocsRef.doc(docId);
    batch.set(newDocRef, {
      docId,
      caseId,
      userId: user.uid,
      sourceDocumentTypeId,
      isLatest: true,
      fileName,
      storagePath,
      mimeType,
      fileSizeBytes,
      uploadedAt: FieldValue.serverTimestamp(),
    });

    batch.update(caseRef, {
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    await enqueueExtraction(caseId, docId, idToken);

    return { success: true };
  } catch (error) {
    console.error("Error finalizing upload:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to finalize upload. Please try again.",
    };
  }
}
