import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Case {
  caseId: string;
  userId: string;
  caseTypeId: string;
  name: string;
  status: "draft" | "open" | "extracting" | "extracted" | "failed";
  latestExtractionId: string | null;
  extractionStatus: string | null;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CaseData {
  caseId: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function convertTimestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

function mapCaseDocument(doc: QueryDocumentSnapshot): CaseData {
  const data = doc.data() as Case;
  return {
    caseId: data.caseId,
    name: data.name,
    status: data.status,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export async function getCases(
  userId: string,
  limitCount: number = 10,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ cases: CaseData[]; lastDoc: QueryDocumentSnapshot | null }> {
  const casesRef = collection(db, "cases");

  let q = query(
    casesRef,
    where("userId", "==", userId),
    where("deletedAt", "==", null),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );

  if (lastDoc) {
    q = query(
      casesRef,
      where("userId", "==", userId),
      where("deletedAt", "==", null),
      orderBy("updatedAt", "desc"),
      startAfter(lastDoc),
      limit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  const cases = snapshot.docs.map(mapCaseDocument);
  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { cases, lastDoc: newLastDoc };
}

export async function getCase(caseId: string): Promise<CaseData | null> {
  const caseRef = doc(db, "cases", caseId);
  const caseDoc = await getDoc(caseRef);

  if (!caseDoc.exists()) {
    return null;
  }

  const data = caseDoc.data() as Case;
  return {
    caseId: data.caseId,
    name: data.name,
    status: data.status,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export function listenToCases(
  userId: string,
  limitCount: number,
  onUpdate: (cases: CaseData[]) => void,
  onError?: (error: Error) => void
): () => void {
  const casesRef = collection(db, "cases");
  const q = query(
    casesRef,
    where("userId", "==", userId),
    where("deletedAt", "==", null),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const cases = snapshot.docs.map(mapCaseDocument);
      onUpdate(cases);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("Error listening to cases:", error);
      }
    }
  );

  return unsubscribe;
}

export function listenToCase(
  caseId: string,
  onUpdate: (caseData: CaseData | null) => void,
  onError?: (error: Error) => void
): () => void {
  const caseRef = doc(db, "cases", caseId);

  const unsubscribe = onSnapshot(
    caseRef,
    (docSnapshot) => {
      if (!docSnapshot.exists()) {
        onUpdate(null);
        return;
      }

      const data = docSnapshot.data() as Case;
      onUpdate({
        caseId: data.caseId,
        name: data.name,
        status: data.status,
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: convertTimestampToDate(data.updatedAt),
      });
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("Error listening to case:", error);
      }
    }
  );

  return unsubscribe;
}
