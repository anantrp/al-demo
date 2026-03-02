import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface FieldSchema {
  label: string;
  required: boolean;
  order?: number;
  cols?: 1 | 2;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  schema: {
    type: string;
    minLength?: number;
    minimum?: number;
    pattern?: string;
    format?: string;
  };
}

export interface CaseType {
  caseTypeId: string;
  name: string;
  description: string;
  fields: Record<string, FieldSchema>;
  userFields: Record<string, FieldSchema>;
  userForm?: {
    heading?: string;
    subheading?: string;
  };
  customValidations: string[];
  isActive: boolean;
  deletedAt: unknown;
}

export async function getCaseType(caseTypeId: string): Promise<CaseType | null> {
  try {
    const caseTypeRef = doc(db, "caseTypes", caseTypeId);
    const caseTypeDoc = await getDoc(caseTypeRef);

    if (!caseTypeDoc.exists()) {
      return null;
    }

    const data = caseTypeDoc.data() as CaseType;

    if (!data.isActive || data.deletedAt != null) {
      return null;
    }

    return {
      caseTypeId: data.caseTypeId,
      name: data.name,
      description: data.description,
      fields: data.fields || {},
      userFields: data.userFields || {},
      userForm: data.userForm,
      customValidations: data.customValidations || [],
      isActive: data.isActive,
      deletedAt: data.deletedAt,
    };
  } catch (error) {
    console.error("Error fetching case type:", error);
    return null;
  }
}
