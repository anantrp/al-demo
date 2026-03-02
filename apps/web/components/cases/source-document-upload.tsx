"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getSourceDocumentsForCaseType,
  type SourceDocumentType,
  type CaseSourceDocument,
} from "@/lib/firestore/source-documents";
import { getUploadUrl, finalizeUpload } from "@/actions/uploads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CircleCheck,
  CircleX,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

interface SourceDocumentUploadProps {
  caseId: string;
  caseTypeId: string;
}

function ExtractionStatusBadge({ uploaded }: { uploaded: CaseSourceDocument }) {
  const { status, validityReason, uploadedAt } = uploaded;
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const checkStale = () => {
      const stale = Date.now() - uploadedAt.getTime() > PROCESSING_TIMEOUT_MS;
      setIsStale(stale);
    };

    checkStale();
    const interval = setInterval(checkStale, 5000);

    return () => clearInterval(interval);
  }, [uploadedAt]);

  if (!status || status === "pending") {
    if (isStale) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <CircleX className="size-3" />
            Failed to process
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Processing...
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Processing...
      </span>
    );
  }

  if (status === "processed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CircleCheck className="size-3" />
        Processing Completed
      </span>
    );
  }

  if (status === "invalid") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <TriangleAlert className="size-3" />
              Invalid
            </span>
          </TooltipTrigger>
          {validityReason && (
            <TooltipContent side="right">
              <p className="max-w-xs">{validityReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <TriangleAlert className="size-3" />
        Flagged
      </span>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <CircleX className="size-3" />
          Failed to process
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
          <RefreshCw className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  return null;
}

export function SourceDocumentUpload({ caseId, caseTypeId }: SourceDocumentUploadProps) {
  const [sourceDocTypes, setSourceDocTypes] = useState<SourceDocumentType[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<CaseSourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseTypeId) {
      setSourceDocTypes([]);
      setUploadedDocs([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    let sourceDocsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const types = await getSourceDocumentsForCaseType(caseTypeId);
        if (mounted) {
          setSourceDocTypes(types);
        }

        const { subscribeToLatestCaseSourceDocuments } =
          await import("@/lib/firestore/source-documents");
        sourceDocsUnsubscribe = subscribeToLatestCaseSourceDocuments(caseId, (docs) => {
          if (mounted) {
            setUploadedDocs(docs);
            setLoading(false);
          }
        });
      } catch (e) {
        if (mounted) {
          setError("Failed to load source documents");
          setLoading(false);
        }
        if (process.env.NODE_ENV === "development") {
          console.error("[SourceDocumentUpload] load error:", e);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      sourceDocsUnsubscribe?.();
    };
  }, [caseId, caseTypeId]);

  const handleFileSelect = async (
    sourceDocumentTypeId: string,
    typeConfig: SourceDocumentType,
    file: File
  ) => {
    setError(null);
    setUploadingTypeId(sourceDocumentTypeId);

    try {
      const maxBytes = typeConfig.maxFileSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File too large. Maximum size: ${typeConfig.maxFileSizeMB}MB`);
        return;
      }
      if (!typeConfig.acceptedMimeTypes.includes(file.type)) {
        setError(`File type not accepted. Allowed: ${typeConfig.acceptedMimeTypes.join(", ")}`);
        return;
      }

      const result = await getUploadUrl(
        caseId,
        sourceDocumentTypeId,
        file.name,
        file.type,
        file.size
      );

      if (!result.success || !result.uploadUrl || !result.docId || !result.storagePath) {
        setError(result.error ?? "Failed to get upload URL");
        return;
      }

      const uploadRes = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        setError("Upload failed. Please try again.");
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("Session expired. Please sign in again.");
        return;
      }

      const idToken = await currentUser.getIdToken();
      const finalizeResult = await finalizeUpload(
        caseId,
        result.docId,
        sourceDocumentTypeId,
        file.name,
        file.type,
        file.size,
        result.storagePath,
        idToken
      );

      if (!finalizeResult.success) {
        setError(finalizeResult.error ?? "Failed to finalize upload");
      }
    } catch {
      setError("Failed to upload image, please try again later.");
    } finally {
      setUploadingTypeId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (!caseTypeId) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        Case type not set.
      </div>
    );
  }

  if (sourceDocTypes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        No source documents configured for this case type.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {sourceDocTypes.map((typeConfig) => {
          const uploaded = uploadedDocs.find(
            (d) => d.sourceDocumentTypeId === typeConfig.sourceDocumentTypeId
          );
          const isUploading = uploadingTypeId === typeConfig.sourceDocumentTypeId;
          return (
            <Card key={typeConfig.sourceDocumentTypeId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  {typeConfig.name}
                </CardTitle>
                <CardDescription>{typeConfig.description}</CardDescription>
                <p className="text-xs text-muted-foreground">
                  Accepted: {typeConfig.acceptedMimeTypes.join(", ")} • Max{" "}
                  {typeConfig.maxFileSizeMB}MB
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {uploaded ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span className="truncate">{uploaded.fileName}</span>
                    </div>
                    <ExtractionStatusBadge uploaded={uploaded} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Upload this document to proceed</span>
                  </div>
                )}
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept={typeConfig.acceptedMimeTypes.join(",")}
                    className="sr-only"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(typeConfig.sourceDocumentTypeId, typeConfig, file);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    className="w-full pointer-events-none"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Uploading...
                      </>
                    ) : uploaded ? (
                      <>
                        <Upload className="size-4" />
                        Replace
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
