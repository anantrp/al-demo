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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { listenToCase, CaseData } from "@/lib/firestore/cases";
import { EditableCaseName } from "@/components/cases/editable-case-name";
import { SourceDocumentUpload } from "@/components/cases/source-document-upload";
import { UserFieldsForm } from "@/components/cases/user-fields-form";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function CasePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const initialError = !caseId ? "Invalid case ID" : null;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(!initialError);
  const [error, setError] = useState<string | null>(initialError);

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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Cases</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
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
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">{error}</div>
            <Link href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Return to Cases
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <EditableCaseName caseId={caseId} initialName={caseData?.name || ""} />
                <p className="text-sm text-muted-foreground">
                  {caseData && (
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
                  )}
                </p>
              </div>
              {caseData && (
                <UserFieldsForm
                  caseId={caseId}
                  caseTypeId={caseData.caseTypeId}
                  initialValues={caseData.userFields}
                />
              )}
            </div>
            {caseData && (
              <div className="space-y-6">
                <SourceDocumentUpload caseId={caseId} caseTypeId={caseData.caseTypeId} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
