"use server";

import { adminDb } from "@/lib/firebase-admin";
import { verifySession } from "./auth";
import type { CaseReadinessResult } from "@/lib/types/case-readiness";

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  const sec = (value as { seconds?: number }).seconds ?? (value as { _seconds?: number })._seconds;
  if (typeof sec === "number") return new Date(sec * 1000);
  return new Date();
}

export async function checkCaseReadiness(caseId: string): Promise<CaseReadinessResult> {
  try {
    const user = await verifySession();

    if (!user) {
      return { userFields: false, sourceDocuments: false, error: "Authentication required" };
    }

    const caseRef = adminDb.collection("cases").doc(caseId);
    const caseDoc = await caseRef.get();

    if (!caseDoc.exists) {
      return { userFields: false, sourceDocuments: false, error: "Case not found" };
    }

    const caseData = caseDoc.data();
    if (caseData?.userId !== user.uid) {
      return { userFields: false, sourceDocuments: false, error: "Unauthorized" };
    }

    const caseTypeRef = adminDb.collection("caseTypes").doc(caseData.caseTypeId);
    const caseTypeDoc = await caseTypeRef.get();

    if (!caseTypeDoc.exists) {
      return { userFields: false, sourceDocuments: false, error: "Case type not found" };
    }

    const caseTypeData = caseTypeDoc.data();
    const userFields = (caseTypeData?.userFields || {}) as Record<
      string,
      { label: string; required: boolean }
    >;
    const caseTypeFields = (caseTypeData?.fields || {}) as Record<
      string,
      { label: string; required: boolean }
    >;

    const missingRequiredUserFields: Array<{ fieldId: string; label: string }> = [];
    const caseUserFieldValues = caseData.userFields || {};

    const isValueEmpty = (v: unknown): boolean =>
      v === undefined || v === null || v === "" || (typeof v === "string" && v.trim() === "");

    for (const [fieldId, fieldSchema] of Object.entries(userFields)) {
      const requiredByCaseType =
        fieldSchema.required === true ||
        (typeof fieldSchema.required === "string" && fieldSchema.required === "true");
      const isEmpty = isValueEmpty(caseUserFieldValues[fieldId]);
      if (requiredByCaseType && isEmpty) {
        missingRequiredUserFields.push({
          fieldId,
          label: fieldSchema.label,
        });
      }
    }

    const sourceDocTypeSnapshot = await adminDb
      .collection("caseTypes")
      .doc(caseData.caseTypeId)
      .collection("sourceDocuments")
      .where("isActive", "==", true)
      .where("deletedAt", "==", null)
      .get();

    const sourceDocTypes: Array<{
      sourceDocumentTypeId: string;
      name: string;
      extractsFields: string[];
    }> = sourceDocTypeSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        sourceDocumentTypeId: data.sourceDocumentTypeId,
        name: data.name,
        extractsFields: data.extractsFields || [],
      };
    });

    const caseSourceDocsSnapshot = await adminDb
      .collection("cases")
      .doc(caseId)
      .collection("sourceDocuments")
      .where("isLatest", "==", true)
      .get();

    const caseSourceDocs = new Map(
      caseSourceDocsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return [
          data.sourceDocumentTypeId,
          {
            docId: data.docId,
            sourceDocumentTypeId: data.sourceDocumentTypeId,
            latestExtractionId: data.latestExtractionId || null,
            status: data.status || null,
            validityReason: data.validityReason || null,
            uploadedAt: data.uploadedAt,
          },
        ];
      })
    );

    const sourceDocumentStatuses: Array<{
      sourceDocumentTypeId: string;
      sourceDocumentName: string;
      status: "pending" | "processing" | "invalid" | "validation_failed" | "failed" | "completed";
      message: string;
    }> = [];

    const pushStatus = (
      id: string,
      name: string,
      status: "pending" | "processing" | "invalid" | "validation_failed" | "failed" | "completed",
      message: string
    ) => {
      sourceDocumentStatuses.push({
        sourceDocumentTypeId: id,
        sourceDocumentName: name,
        status,
        message,
      });
    };

    for (const sourceDocType of sourceDocTypes) {
      const caseSourceDoc = caseSourceDocs.get(sourceDocType.sourceDocumentTypeId);

      if (!caseSourceDoc) {
        pushStatus(
          sourceDocType.sourceDocumentTypeId,
          sourceDocType.name,
          "pending",
          `${sourceDocType.name} is pending`
        );
        continue;
      }

      const uploadedAt = toDate(caseSourceDoc.uploadedAt);
      const timeSinceUpload = Date.now() - uploadedAt.getTime();
      const isStaleProcessing = timeSinceUpload > PROCESSING_TIMEOUT_MS;

      if (!caseSourceDoc.latestExtractionId) {
        if (isStaleProcessing) {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "failed",
            `${sourceDocType.name} failed to process (please try again with a better quality document)`
          );
        } else {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "processing",
            `${sourceDocType.name} is processing`
          );
        }
        continue;
      }

      const extractionDoc = await adminDb
        .collection("extractions")
        .doc(caseSourceDoc.latestExtractionId)
        .get();

      if (!extractionDoc.exists) {
        if (isStaleProcessing) {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "failed",
            `${sourceDocType.name} failed to process (please try again with a better quality document)`
          );
        } else {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "processing",
            `${sourceDocType.name} is processing`
          );
        }
        continue;
      }

      const extractionData = extractionDoc.data();
      const extractionStatus = extractionData?.status;

      if (extractionStatus === "pending" || extractionStatus === "processing") {
        if (isStaleProcessing) {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "failed",
            `${sourceDocType.name} failed to process (please try again with a better quality document)`
          );
        } else {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "processing",
            `${sourceDocType.name} is processing`
          );
        }
        continue;
      }

      if (extractionStatus === "invalid") {
        pushStatus(
          sourceDocType.sourceDocumentTypeId,
          sourceDocType.name,
          "invalid",
          `Valid ${sourceDocType.name} missing`
        );
        continue;
      }

      if (extractionStatus === "failed") {
        pushStatus(
          sourceDocType.sourceDocumentTypeId,
          sourceDocType.name,
          "failed",
          "Validation issue. Please try again with a better quality document"
        );
        continue;
      }

      if (extractionStatus === "flagged") {
        const requiredFieldsMissing = sourceDocType.extractsFields.some((fieldId) => {
          const fieldSchema = caseTypeFields[fieldId];
          if (!fieldSchema?.required) return false;
          const fieldData = extractionData?.fields?.[fieldId];
          return !fieldData || fieldData.value == null || fieldData.value === "";
        });

        if (requiredFieldsMissing) {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "validation_failed",
            "Validation issue. Please try again with a better quality document"
          );
        } else {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "completed",
            `${sourceDocType.name} completed`
          );
        }
        continue;
      }

      if (extractionStatus === "processed") {
        const requiredFieldsMissing = sourceDocType.extractsFields.some((fieldId) => {
          const fieldSchema = caseTypeFields[fieldId];
          if (!fieldSchema?.required) return false;
          const fieldData = extractionData?.fields?.[fieldId];
          return !fieldData || fieldData.value == null || fieldData.value === "";
        });

        if (requiredFieldsMissing) {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "validation_failed",
            "Required fields missing from extraction"
          );
        } else {
          pushStatus(
            sourceDocType.sourceDocumentTypeId,
            sourceDocType.name,
            "completed",
            `${sourceDocType.name} completed`
          );
        }
      }
    }

    const userFieldsComplete = missingRequiredUserFields.length === 0;
    const sourceDocumentsComplete = sourceDocumentStatuses.every((s) => s.status === "completed");

    return { userFields: userFieldsComplete, sourceDocuments: sourceDocumentsComplete };
  } catch (error) {
    console.error("Error checking case readiness:", error);
    return { userFields: false, sourceDocuments: false, error: "Failed to check case readiness" };
  }
}
