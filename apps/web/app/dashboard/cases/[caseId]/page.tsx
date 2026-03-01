"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Cases</BreadcrumbLink>
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
            <a
              href="/dashboard"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Return to Dashboard
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold">{caseData?.name}</h1>
              <p className="text-sm text-muted-foreground">Status: {caseData?.status}</p>
            </div>
            <div className="bg-muted/50 min-h-[400px] rounded-xl p-6">
              <p className="text-muted-foreground">
                Case details and document processing will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
