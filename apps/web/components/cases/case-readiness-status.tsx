"use client";

import type { CaseReadinessResult } from "@/lib/types/case-readiness";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserFieldsForm } from "@/components/cases/user-fields-form";

interface CaseReadinessStatusProps {
  readiness: CaseReadinessResult | null;
  loading?: boolean;
  caseId?: string;
  caseTypeId?: string;
  initialUserValues?: Record<string, string | number | boolean>;
  headerContent?: React.ReactNode;
  children?: React.ReactNode;
}

export function CaseReadinessStatus({
  readiness,
  loading = false,
  caseId,
  caseTypeId,
  initialUserValues,
  headerContent,
  children,
}: CaseReadinessStatusProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {headerContent}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4 animate-pulse" />
            <span className="text-sm">Checking readiness...</span>
          </div>
        </div>
        {children && <div className="pt-0">{children}</div>}
      </div>
    );
  }

  if (!readiness) {
    return null;
  }

  const ready = !readiness.error && readiness.userFields && readiness.sourceDocuments;
  const userFieldsComplete = readiness.userFields;

  const getStatusBlock = () => {
    if (readiness.error) {
      return (
        <div className="shrink-0 text-right">
          <Badge variant="destructive" className="text-xs">
            Error
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">{readiness.error}</p>
        </div>
      );
    }
    if (ready) {
      return (
        <div className="shrink-0 text-right">
          <Badge variant="default" className="bg-green-600 text-xs hover:bg-green-700">
            Ready
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">documents are ready to download</p>
        </div>
      );
    }
    return (
      <div className="shrink-0 text-right">
        <Badge variant="secondary" className="text-xs">
          Not Ready
        </Badge>
        <p className="mt-1 text-xs text-muted-foreground">
          {!userFieldsComplete
            ? "Please complete the information"
            : "Please upload proper documents below"}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 max-w-[85%]">{headerContent}</div>
        <div className="shrink-0">{getStatusBlock()}</div>
      </div>
      <div className="space-y-4">
        {readiness.error ? (
          <p className="text-sm text-muted-foreground">{readiness.error}</p>
        ) : (
          <>
            {caseId && caseTypeId && (
              <Item
                variant="outline"
                size="sm"
                className={
                  userFieldsComplete
                    ? "flex-col items-stretch border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20 pb-4 sm:flex-row sm:items-center sm:pb-2"
                    : "flex-col items-stretch border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/25 pb-4 sm:flex-row sm:items-center sm:pb-2"
                }
              >
                <ItemContent>
                  <ItemTitle className="text-sm font-medium">
                    {userFieldsComplete
                      ? "Your Information Is Complete"
                      : "Missing Required Information"}
                  </ItemTitle>
                  <ItemDescription>
                    {userFieldsComplete
                      ? "You can review or update your details any time you want."
                      : "Some required details are still needed to generate documents."}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="w-full pt-2 sm:w-auto sm:pt-0">
                  <UserFieldsForm
                    caseId={caseId}
                    caseTypeId={caseTypeId}
                    initialValues={initialUserValues}
                    readiness={readiness}
                    compact
                    triggerSize="sm"
                  />
                </ItemActions>
              </Item>
            )}
          </>
        )}
        {children ? <div className="border-t border-muted pt-4 mt-1">{children}</div> : null}
      </div>
    </div>
  );
}
