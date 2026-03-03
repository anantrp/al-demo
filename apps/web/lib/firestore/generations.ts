import { collection, query, where, onSnapshot, getDocs, DocumentData } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export interface Generation {
  generationId: string;
  templateId: string;
  templateName: string;
  status: "completed" | "failed";
  outputFileName: string | null;
  errorMessage: string | null;
  createdAt: Date;
  generatedAt: Date | null;
}

function mapGeneration(data: DocumentData): Generation {
  return {
    generationId: data.generationId,
    templateId: data.templateId,
    templateName: data.templateName,
    status: data.status,
    outputFileName: data.outputFileName ?? null,
    errorMessage: data.errorMessage ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    generatedAt: data.generatedAt?.toDate() ?? null,
  };
}

export function subscribeToGenerationsForCase(
  caseId: string,
  callback: (generations: Generation[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const generationsRef = collection(db, "generations");
  const q = query(generationsRef, where("userId", "==", user.uid), where("caseId", "==", caseId));

  return onSnapshot(q, (snapshot) => {
    const generations = snapshot.docs.map((doc) => mapGeneration(doc.data()));
    callback(generations);
  });
}

export async function getLatestGenerationForTemplate(
  caseId: string,
  templateId: string
): Promise<Generation | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  const generationsRef = collection(db, "generations");
  const q = query(
    generationsRef,
    where("userId", "==", user.uid),
    where("caseId", "==", caseId),
    where("templateId", "==", templateId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const generations = snapshot.docs
    .map((doc) => mapGeneration(doc.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return generations[0];
}
