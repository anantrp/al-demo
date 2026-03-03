"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NavActions } from "@/components/nav-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { listenToCase, CaseData } from "@/lib/firestore/cases";
import { subscribeToLatestCaseSourceDocuments } from "@/lib/firestore/source-documents";
import { checkCaseReadiness } from "@/actions/case-readiness";
import type { CaseReadinessResult } from "@/lib/types/case-readiness";
import { EditableCaseName } from "@/components/cases/editable-case-name";
import { SourceDocumentUpload } from "@/components/cases/source-document-upload";
import { DocumentOutputs } from "@/components/cases/document-outputs";
import { CaseReadinessStatus } from "@/components/cases/case-readiness-status";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GalleryVerticalEnd } from "lucide-react";

export default function CasePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const initialError = !caseId ? "Invalid case ID" : null;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(!initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [readinessRefreshTrigger, setReadinessRefreshTrigger] = useState(0);
  const [readiness, setReadiness] = useState<CaseReadinessResult | null>(null);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    const unsubscribe = listenToCase(
      caseId,
      (data) => {
        if (data === null) {
          setError("Case not found or you don't have access to it");
        } else {
          setCaseData(data);
          setError(null);
          setReadinessRefreshTrigger((prev) => prev + 1);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to case:", err);
        setError("Failed to load case");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [caseId]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    const unsubscribe = subscribeToLatestCaseSourceDocuments(caseId, () => {
      setReadinessRefreshTrigger((prev) => prev + 1);
    });

    return () => unsubscribe();
  }, [caseId]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let mounted = true;

    const fetchReadiness = async () => {
      try {
        const result = await checkCaseReadiness(caseId);
        if (mounted) {
          setReadiness(result);
        }
      } catch (err) {
        console.error("Error checking case readiness:", err);
      }
    };

    fetchReadiness();

    return () => {
      mounted = false;
    };
  }, [caseId, readinessRefreshTrigger]);

  return (
    <div className="fixed inset-0 flex flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:h-16 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/" className="flex items-center gap-1.5">
                    <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                      <GalleryVerticalEnd className="size-4" />
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Cases</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[120px] truncate sm:max-w-none">
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : error ? (
                    "Error"
                  ) : (
                    caseData?.name || "Unknown"
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto px-3">
          <NavActions />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-6 pt-3 sm:pt-4 md:pt-6 overflow-auto md:overflow-visible">
        <div className="mx-auto w-full max-w-7xl">
          {loading ? (
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8 lg:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-32 w-full rounded-lg" />
                  </div>
                </div>
                <aside className="min-w-0 lg:sticky lg:top-6">
                  <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
                    <Skeleton className="mb-4 h-5 w-32" />
                    <Skeleton className="mb-3 h-9 w-full rounded-md" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-[80%] rounded-md" />
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
              <div className="text-center text-lg font-semibold text-destructive">{error}</div>
              <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
                Return to Cases
              </Link>
            </div>
          ) : caseData ? (
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8 lg:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                  <section className="w-full" aria-label="Case status and source documents">
                    <CaseReadinessStatus
                      readiness={readiness}
                      loading={!readiness}
                      caseId={caseId}
                      caseTypeId={caseData.caseTypeId}
                      initialUserValues={caseData.userFields}
                      headerContent={
                        <>
                          <EditableCaseName caseId={caseId} initialName={caseData.name || ""} />
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">
                                    {formatRelativeTime(caseData.updatedAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{formatDateTime(caseData.updatedAt)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </p>
                        </>
                      }
                    >
                      <SourceDocumentUpload caseId={caseId} caseTypeId={caseData.caseTypeId} />
                    </CaseReadinessStatus>
                  </section>
                </div>

                <aside className="min-w-0 lg:sticky lg:top-6" aria-label="Templates">
                  <div className="flex flex-col rounded-xl border bg-card shadow-sm">
                    <DocumentOutputs
                      caseId={caseId}
                      caseTypeId={caseData.caseTypeId}
                      readiness={readiness}
                      variant="panel"
                    />
                  </div>
                </aside>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
