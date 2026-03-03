import { collection, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Template {
  templateId: string;
  name: string;
  description: string;
  referenceFields: string[];
  referenceUserFields: string[];
  storagePath: string;
  version: string;
  documentDownloadName: string;
}

interface TemplateDoc {
  templateId: string;
  name: string;
  description: string;
  referenceFields: string[];
  referenceUserFields: string[];
  storagePath: string;
  version: string;
  documentDownloadName: string;
  isActive: boolean;
  deletedAt: unknown;
}

function mapTemplate(doc: QueryDocumentSnapshot): Template | null {
  const data = doc.data() as TemplateDoc;
  if (!data.isActive || data.deletedAt != null) {
    return null;
  }
  return {
    templateId: data.templateId,
    name: data.name,
    description: data.description,
    referenceFields: data.referenceFields ?? [],
    referenceUserFields: data.referenceUserFields ?? [],
    storagePath: data.storagePath,
    version: data.version,
    documentDownloadName: data.documentDownloadName ?? "document.docx",
  };
}

export async function getTemplatesForCaseType(caseTypeId: string): Promise<Template[]> {
  const templatesRef = collection(db, "caseTypes", caseTypeId, "templates");
  const snapshot = await getDocs(templatesRef);
  return snapshot.docs.map(mapTemplate).filter((t): t is Template => t !== null);
}
