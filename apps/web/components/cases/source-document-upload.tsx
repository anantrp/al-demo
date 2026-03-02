"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getSourceDocumentsForCaseType,
  getLatestCaseSourceDocuments,
  type SourceDocumentType,
  type CaseSourceDocument,
} from "@/lib/firestore/source-documents";
import { getUploadUrl, finalizeUpload } from "@/actions/uploads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";

interface SourceDocumentUploadProps {
  caseId: string;
  caseTypeId: string;
  caseStatus: string;
}

export function SourceDocumentUpload({
  caseId,
  caseTypeId,
  caseStatus,
}: SourceDocumentUploadProps) {
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      if (!user) {
        setLoading(false);
        return;
      }
      async function load() {
        try {
          const types = await getSourceDocumentsForCaseType(caseTypeId);
          const docs = await getLatestCaseSourceDocuments(caseId);
          if (mounted) {
            setSourceDocTypes(types);
            setUploadedDocs(docs);
          }
        } catch (e) {
          if (mounted) setError("Failed to load source documents");
          if (process.env.NODE_ENV === "development") {
            console.error("[SourceDocumentUpload] load error:", e);
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }
      load();
    });
    return () => {
      mounted = false;
      unsubscribe();
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
      } else {
        const updated = await getLatestCaseSourceDocuments(caseId);
        setUploadedDocs(updated);
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
              <CardContent className="space-y-2">
                {uploaded && (
                  <p className="text-sm text-muted-foreground">Uploaded: {uploaded.fileName}</p>
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
      {caseStatus !== "draft" && caseStatus !== "open" && (
        <p className="text-sm text-muted-foreground">Status: {caseStatus}</p>
      )}
    </div>
  );
}
