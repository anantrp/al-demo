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
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Download, Eye, FileOutput, Loader2, Search } from "lucide-react";
import type { CaseReadinessResult } from "@/lib/types/case-readiness";

interface DocumentOutputsProps {
  caseId: string;
  caseTypeId: string;
  readiness?: CaseReadinessResult | null;
  variant?: "default" | "panel";
}

function filterTemplates(templates: Template[], query: string): Template[] {
  if (!query.trim()) return templates;
  const q = query.trim().toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
  );
}

export function DocumentOutputs({
  caseId,
  caseTypeId,
  readiness,
  variant = "default",
}: DocumentOutputsProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  const isPanel = variant === "panel";

  if (loading) {
    return (
      <div className={isPanel ? "p-4 space-y-4" : "space-y-4"}>
        <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (!caseTypeId) {
    return (
      <div className={isPanel ? "p-4" : undefined}>
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No documents configured for this case type.
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={isPanel ? "p-4" : undefined}>
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No documents configured for this case type.
        </div>
      </div>
    );
  }

  const isReady = Boolean(
    readiness && !readiness.error && readiness.userFields && readiness.sourceDocuments
  );
  const filteredTemplates = filterTemplates(templates, searchQuery);

  const templateList = isPanel ? (
    <TooltipProvider>
      <ItemGroup className="space-y-2">
        {filteredTemplates.map((template) => {
          const isDownloading = downloadingTemplateId === template.templateId;
          const isPreviewing = previewingTemplateId === template.templateId;

          return (
            <Item
              key={template.templateId}
              variant="outline"
              size="sm"
              className="flex-col items-stretch sm:flex-row sm:items-center"
            >
              <ItemContent>
                <ItemTitle className="truncate text-sm">{template.name}</ItemTitle>
                {template.description && (
                  <ItemDescription className="line-clamp-2 wrap-break-word">
                    {template.description}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions className="w-full flex-row gap-2 border-t border-border pt-2 sm:w-auto sm:border-0 sm:pt-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 sm:size-8 sm:flex-none sm:px-0"
                      disabled={!isReady || isPreviewing || isDownloading}
                      onClick={() => handlePreview(template.templateId, template.name)}
                      aria-label={isPreviewing ? "Loading preview" : "Preview"}
                    >
                      {isPreviewing ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <Eye className="size-4 shrink-0" />
                      )}
                      <span className="sm:sr-only">Preview</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isPreviewing ? "Loading preview..." : "Preview"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="flex-1 gap-1.5 sm:size-8 sm:flex-none sm:px-0"
                      disabled={!isReady || isDownloading || isPreviewing}
                      onClick={() => handleDownload(template.templateId)}
                      aria-label={isDownloading ? "Downloading" : "Download"}
                    >
                      {isDownloading ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <Download className="size-4 shrink-0" />
                      )}
                      <span className="sm:sr-only">Download</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isDownloading ? "Downloading..." : "Download"}</p>
                  </TooltipContent>
                </Tooltip>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </TooltipProvider>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredTemplates.map((template) => {
        const isDownloading = downloadingTemplateId === template.templateId;
        const isPreviewing = previewingTemplateId === template.templateId;

        return (
          <Card key={template.templateId} className="">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileOutput className="size-4 shrink-0" />
                <span className="truncate">{template.name}</span>
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0"
                  disabled={!isReady || isPreviewing || isDownloading}
                  onClick={() => handlePreview(template.templateId, template.name)}
                >
                  {isPreviewing ? (
                    <Loader2 className="size-4 animate-spin shrink-0" />
                  ) : (
                    <Eye className="size-4 shrink-0" />
                  )}
                  {isPreviewing ? "Loading..." : "Preview"}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="flex-1 min-w-0"
                  disabled={!isReady || isDownloading || isPreviewing}
                  onClick={() => handleDownload(template.templateId)}
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="size-4 shrink-0" />
                  )}
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <>
      {isPanel ? (
        <div className="flex flex-col">
          <div className="shrink-0 space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search available downloads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search available downloads"
              />
            </div>
            {filteredTemplates.length !== templates.length && (
              <p className="text-xs text-muted-foreground">
                {filteredTemplates.length} of {templates.length} templates
              </p>
            )}
          </div>
          {error && (
            <div className="shrink-0 px-4 pb-2">
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}
          <div
            className="px-4 pb-4 overflow-y-auto scrollbar-thin"
            style={{ maxHeight: "calc(100dvh - 12rem)" }}
          >
            {filteredTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {searchQuery.trim() ? "No documents match your search." : "No documents."}
              </p>
            ) : (
              templateList
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Documents</h2>
            <p className="text-sm text-muted-foreground">
              {isReady
                ? "Documents are ready to preview and download"
                : "Complete all requirements above to unlock templates"}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search available downloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search available downloads"
            />
          </div>
          {filteredTemplates.length !== templates.length && (
            <p className="text-xs text-muted-foreground">
              {filteredTemplates.length} of {templates.length} documents
            </p>
          )}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            {filteredTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {searchQuery.trim() ? "No documents match your search." : "No documents."}
              </p>
            ) : (
              templateList
            )}
          </div>
        </div>
      )}

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
