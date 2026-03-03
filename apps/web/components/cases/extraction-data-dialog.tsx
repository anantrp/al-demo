"use client";

import { useEffect, useState } from "react";
import { getExtractionById } from "@/lib/firestore/extractions";
import { getCaseType } from "@/lib/firestore/case-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, TriangleAlert } from "lucide-react";

interface ExtractionDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractionId: string | null;
  caseTypeId: string;
  extractsFields: string[];
  documentName: string;
}

export function ExtractionDataDialog({
  open,
  onOpenChange,
  extractionId,
  caseTypeId,
  extractsFields,
  documentName,
}: ExtractionDataDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Array<{
    label: string;
    value: string;
    flagged: boolean;
    confidence: number | undefined;
    flagReason: string | null;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setRows(null);
        setError(null);
      });
      return;
    }
    if (!extractionId) {
      queueMicrotask(() => {
        setRows([]);
        setError(null);
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    Promise.all([getExtractionById(extractionId), getCaseType(caseTypeId)])
      .then(([extraction, caseType]) => {
        if (cancelled) return;
        if (!extraction) {
          setError("Extraction not found.");
          setRows(null);
          return;
        }
        const fieldLabels = caseType?.fields ?? {};
        const extractionFields = extraction.fields ?? {};
        const nextRows = extractsFields.map((fieldId) => {
          const schema = fieldLabels[fieldId];
          const label = schema?.label ?? fieldId;
          const field = extractionFields[fieldId];
          const value = field?.value != null && field?.value !== "" ? String(field.value) : "—";
          return {
            label,
            value,
            flagged: !!field?.flagged,
            confidence: field?.confidence,
            flagReason: field?.flagReason ?? null,
          };
        });
        setRows(nextRows);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load extraction data.");
          setRows(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, extractionId, caseTypeId, extractsFields]);

  const confidenceStr = (c: number | undefined) => (c != null ? `${Math.round(c * 100)}%` : "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:!max-w-[50vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Extraction data — {documentName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 min-h-0 -mx-1 px-1">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {error && <p className="py-6 text-sm text-destructive">{error}</p>}
          {!loading && !error && !extractionId && (
            <p className="py-6 text-sm text-muted-foreground">No extraction data available yet.</p>
          )}
          {!loading && !error && extractionId && rows && rows.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              No extraction fields for this document.
            </p>
          )}
          {!loading && !error && rows && rows.length > 0 && (
            <>
              <div className="space-y-4 md:hidden">
                {rows.map((row, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{row.label}</div>
                    <div className="text-sm">{row.value}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {confidenceStr(row.confidence)}
                    </div>
                    {row.flagged && (row.flagReason || true) && (
                      <div className="flex items-start gap-2 pt-1 text-amber-600 dark:text-amber-500">
                        <TriangleAlert className="size-4 shrink-0 mt-0.5" aria-hidden />
                        <span className="text-xs">{row.flagReason ?? "Flagged"}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Label</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[100px]">Confidence</TableHead>
                      <TableHead className="w-[140px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>{row.value}</TableCell>
                        <TableCell>{confidenceStr(row.confidence)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.flagged ? (
                            <span className="flex items-center gap-2">
                              <TriangleAlert
                                className="size-4 shrink-0 text-amber-500"
                                aria-hidden
                              />
                              {row.flagReason ?? ""}
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
