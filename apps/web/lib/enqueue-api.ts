const ENQUEUE_API_URL = process.env.ENQUEUE_API_URL;

const UPLOAD_ERROR_MESSAGE = "Failed to upload image, please try again later.";

export async function enqueueExtraction(
  caseId: string,
  sourceDocumentId: string,
  idToken: string
): Promise<{ extractionId: string }> {
  if (!ENQUEUE_API_URL) {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  }

  const url = `${ENQUEUE_API_URL.replace(/\/$/, "")}/enqueue/extraction`;
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
  } catch {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  }

  const data = (await res.json()) as { extractionId: string };
  return data;
}
