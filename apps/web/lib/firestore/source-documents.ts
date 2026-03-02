import { collection, query, where, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SourceDocumentType {
  sourceDocumentTypeId: string;
  name: string;
  description: string;
  acceptedMimeTypes: string[];
  maxFileSizeMB: number;
}

interface SourceDocumentTypeDoc {
  sourceDocumentTypeId: string;
  name: string;
  description: string;
  acceptedMimeTypes: string[];
  maxFileSizeMB: number;
  isActive: boolean;
  deletedAt: unknown;
}

function mapSourceDocumentType(doc: QueryDocumentSnapshot): SourceDocumentType | null {
  const data = doc.data() as SourceDocumentTypeDoc;
  if (!data.isActive || data.deletedAt != null) {
    return null;
  }
  return {
    sourceDocumentTypeId: data.sourceDocumentTypeId,
    name: data.name,
    description: data.description,
    acceptedMimeTypes: data.acceptedMimeTypes ?? [],
    maxFileSizeMB: data.maxFileSizeMB ?? 10,
  };
}

export async function getSourceDocumentsForCaseType(
  caseTypeId: string
): Promise<SourceDocumentType[]> {
  const sourceDocsRef = collection(db, "caseTypes", caseTypeId, "sourceDocuments");
  const snapshot = await getDocs(sourceDocsRef);
  return snapshot.docs
    .map(mapSourceDocumentType)
    .filter((t): t is SourceDocumentType => t !== null);
}

export interface CaseSourceDocument {
  docId: string;
  sourceDocumentTypeId: string;
  fileName: string;
  isLatest: boolean;
  latestExtractionId?: string | null;
}

export async function getLatestCaseSourceDocuments(caseId: string): Promise<CaseSourceDocument[]> {
  const sourceDocsRef = collection(db, "cases", caseId, "sourceDocuments");
  const q = query(sourceDocsRef, where("isLatest", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      docId: data.docId,
      sourceDocumentTypeId: data.sourceDocumentTypeId,
      fileName: data.fileName,
      isLatest: data.isLatest,
    };
  });
}
