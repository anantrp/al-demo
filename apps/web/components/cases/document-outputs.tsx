"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getTemplatesForCaseType, type Template } from "@/lib/firestore/templates";
import { downloadDocument } from "@/lib/enqueue-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileOutput, Loader2 } from "lucide-react";

interface DocumentOutputsProps {
  caseId: string;
  caseTypeId: string;
}

export function DocumentOutputs({ caseId, caseTypeId }: DocumentOutputsProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingTemplateId, setDownloadingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => {
          const isDownloading = downloadingTemplateId === template.templateId;

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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isDownloading}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
