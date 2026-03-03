import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ExtractionFieldValue {
  value: unknown;
  confidence?: number;
  flagged?: boolean;
  flagReason?: string | null;
}

export interface Extraction {
  extractionId: string;
  status: "pending" | "processing" | "processed" | "invalid" | "flagged" | "failed";
  valid: boolean | null;
  validityReason: string | null;
  legible: boolean | null;
  validationErrors: Array<{ rule: string; message: string }> | null;
  errorMessage: string | null;
  fields: Record<string, ExtractionFieldValue>;
}

export async function getExtractionById(extractionId: string): Promise<Extraction | null> {
  const ref = doc(db, "extractions", extractionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const rawFields = data.fields ?? {};
  const fields: Record<string, ExtractionFieldValue> = {};
  for (const [key, f] of Object.entries(rawFields)) {
    const field = f as Record<string, unknown>;
    fields[key] = {
      value: field.value,
      confidence: typeof field.confidence === "number" ? field.confidence : undefined,
      flagged: !!field.flagged,
      flagReason: field.flagReason != null ? String(field.flagReason) : null,
    };
  }
  return {
    extractionId: data.extractionId,
    status: data.status,
    valid: data.valid ?? null,
    validityReason: data.validityReason ?? null,
    legible: data.legible ?? null,
    validationErrors: data.validationErrors ?? null,
    errorMessage: data.errorMessage ?? null,
    fields,
  };
}
