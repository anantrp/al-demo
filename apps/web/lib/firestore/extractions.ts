import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Extraction {
  extractionId: string;
  status: "pending" | "processing" | "processed" | "invalid" | "flagged" | "failed";
  valid: boolean | null;
  validityReason: string | null;
  legible: boolean | null;
  validationErrors: Array<{ rule: string; message: string }> | null;
  errorMessage: string | null;
}

export async function getExtractionById(extractionId: string): Promise<Extraction | null> {
  const ref = doc(db, "extractions", extractionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    extractionId: data.extractionId,
    status: data.status,
    valid: data.valid ?? null,
    validityReason: data.validityReason ?? null,
    legible: data.legible ?? null,
    validationErrors: data.validationErrors ?? null,
    errorMessage: data.errorMessage ?? null,
  };
}
