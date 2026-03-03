const API_URL = process.env.NEXT_PUBLIC_API_URL;

const UPLOAD_ERROR_MESSAGE = "Failed to upload document. Please try again";
const DOWNLOAD_ERROR_MESSAGE = "Failed to download document. Please try again";

export async function enqueueExtraction(
  caseId: string,
  sourceDocumentId: string,
  idToken: string
): Promise<{ extractionId: string }> {
  if (!API_URL) {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  }

  const url = `${API_URL.replace(/\/$/, "")}/enqueue/extraction`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ caseId, sourceDocumentId }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Upload timed out. Please try again.");
    }
    throw new Error(UPLOAD_ERROR_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    try {
      const errorData = await res.json();
      throw new Error(errorData.detail || UPLOAD_ERROR_MESSAGE);
    } catch {
      throw new Error(UPLOAD_ERROR_MESSAGE);
    }
  }

  const data = (await res.json()) as { extractionId: string };
  return data;
}

export async function downloadDocument(
  caseId: string,
  templateId: string,
  idToken: string
): Promise<{ blob: Blob; filename: string }> {
  if (!API_URL) {
    throw new Error(DOWNLOAD_ERROR_MESSAGE);
  }

  const url = `${API_URL.replace(/\/$/, "")}/documents/${caseId}/${templateId}/download`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Download timed out. Please try again.");
    }
    const errorMessage = error instanceof Error ? error.message : DOWNLOAD_ERROR_MESSAGE;
    console.error("[downloadDocument] Fetch error:", errorMessage, "URL:", url);
    throw new Error(`${DOWNLOAD_ERROR_MESSAGE} (${errorMessage})`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    try {
      const errorData = await res.json();
      throw new Error(errorData.detail || DOWNLOAD_ERROR_MESSAGE);
    } catch (jsonError) {
      if (jsonError instanceof Error && jsonError.message !== DOWNLOAD_ERROR_MESSAGE) {
        throw jsonError;
      }
      throw new Error(`${DOWNLOAD_ERROR_MESSAGE} (HTTP ${res.status})`);
    }
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = "document.docx";

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  return { blob, filename };
}
