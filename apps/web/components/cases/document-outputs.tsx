"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { auth } from "@/lib/firebase";
import { getTemplatesForCaseType, type Template } from "@/lib/firestore/templates";
import { downloadDocument } from "@/lib/enqueue-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Eye, FileOutput, Loader2 } from "lucide-react";

interface DocumentOutputsProps {
  caseId: string;
  caseTypeId: string;
}

export function DocumentOutputs({ caseId, caseTypeId }: DocumentOutputsProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingTemplateId, setDownloadingTemplateId] = useState<string | null>(null);
  const [previewingTemplateId, setPreviewingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewTemplateName, setPreviewTemplateName] = useState<string>("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!caseTypeId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadData = async () => {
      try {
        const templatesData = await getTemplatesForCaseType(caseTypeId);
        if (mounted) {
          setTemplates(templatesData);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError("Failed to load templates");
          setLoading(false);
        }
        if (process.env.NODE_ENV === "development") {
          console.error("[DocumentOutputs] load error:", e);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [caseTypeId]);

  const handleDownload = async (templateId: string) => {
    setError(null);
    setDownloadingTemplateId(templateId);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("Please sign in to continue");
        setDownloadingTemplateId(null);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const { blob, filename } = await downloadDocument(caseId, templateId, idToken);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to download document. Please try again";
      setError(errorMessage);
      if (process.env.NODE_ENV === "development") {
        console.error("[DocumentOutputs] download error:", e);
      }
    } finally {
      setDownloadingTemplateId(null);
    }
  };

  const handlePreview = async (templateId: string, templateName: string) => {
    setError(null);
    setPreviewingTemplateId(templateId);
    setPreviewTemplateName(templateName);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("Please sign in to continue");
        setPreviewingTemplateId(null);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const { blob } = await downloadDocument(caseId, templateId, idToken);

      setPreviewBlob(blob);
      setIsPreviewDialogOpen(true);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to preview document. Please try again";
      setError(errorMessage);
      if (process.env.NODE_ENV === "development") {
        console.error("[DocumentOutputs] preview error:", e);
      }
    } finally {
      setPreviewingTemplateId(null);
    }
  };

  useEffect(() => {
    const renderPreview = async () => {
      if (isPreviewDialogOpen && previewBlob) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!previewContainerRef.current) {
          return;
        }

        setIsRenderingPreview(true);
        try {
          previewContainerRef.current.innerHTML = "";
          await renderAsync(previewBlob, previewContainerRef.current, undefined, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: false,
            trimXmlDeclaration: true,
            useBase64URL: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : "Failed to render document preview";
          setError(errorMessage);
          if (process.env.NODE_ENV === "development") {
            console.error("[DocumentOutputs] render error:", e);
          }
        } finally {
          setIsRenderingPreview(false);
        }
      }
    };

    renderPreview();
  }, [isPreviewDialogOpen, previewBlob]);

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

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        No templates configured for this case type.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => {
            const isDownloading = downloadingTemplateId === template.templateId;
            const isPreviewing = previewingTemplateId === template.templateId;

            return (
              <Card key={template.templateId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileOutput className="size-4" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={isPreviewing || isDownloading}
                      onClick={() => handlePreview(template.templateId, template.name)}
                    >
                      {isPreviewing ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye className="size-4" />
                          Preview
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="flex-1"
                      disabled={isDownloading || isPreviewing}
                      onClick={() => handleDownload(template.templateId)}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="size-4" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-[98vw]! sm:max-w-[95vw]! lg:max-w-[90vw]! w-[98vw] sm:w-[95vw] lg:w-[90vw] h-[95vh] overflow-hidden flex flex-col p-3 sm:p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{previewTemplateName}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Document preview</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md border bg-gray-100 relative min-h-0">
            {isRenderingPreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Rendering document...</span>
                </div>
              </div>
            )}
            <div className="p-2 sm:p-4 md:p-6 overflow-auto h-full w-full">
              <div
                ref={previewContainerRef}
                className="docx-wrapper"
                style={{ margin: "0 auto" }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
