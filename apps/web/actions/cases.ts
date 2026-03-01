"use server";

import { adminDb } from "@/lib/firebase-admin";
import { verifySession } from "./auth";
import { FieldValue } from "firebase-admin/firestore";

export interface CreateCaseResult {
  success: boolean;
  caseId?: string;
  error?: string;
}

export async function createCase(name: string): Promise<CreateCaseResult> {
  try {
    const user = await verifySession();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: "Case name is required" };
    }

    if (name.trim().length > 100) {
      return { success: false, error: "Case name must be 100 characters or less" };
    }

    const caseRef = adminDb.collection("cases").doc();
    const caseId = `case_${caseRef.id}`;

    const caseData = {
      caseId,
      userId: user.uid,
      caseTypeId: "death_certificate_flow",
      name: name.trim(),
      status: "draft",
      latestExtractionId: null,
      extractionStatus: null,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("cases").doc(caseId).set(caseData);

    return { success: true, caseId };
  } catch (error) {
    console.error("Error creating case:", error);
    return { success: false, error: "Failed to create case. Please try again." };
  }
}

export interface UpdateCaseNameResult {
  success: boolean;
  error?: string;
}

export async function updateCaseName(caseId: string, name: string): Promise<UpdateCaseNameResult> {
  try {
    const user = await verifySession();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: "Case name is required" };
    }

    if (name.trim().length > 100) {
      return { success: false, error: "Case name must be 100 characters or less" };
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

    await caseRef.update({
      name: name.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating case name:", error);
    return { success: false, error: "Failed to update case name. Please try again." };
  }
}
