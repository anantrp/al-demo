"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileUp,
  ShieldCheck,
  Download,
  Check,
  FileStack,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listenToCases, CaseData } from "@/lib/firestore/cases";
import { createCase } from "@/actions/cases";
import { checkCaseReadiness } from "@/actions/case-readiness";
import type { CaseReadinessResult } from "@/lib/types/case-readiness";
import { formatRelativeTime } from "@/lib/utils";

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

interface CasesHomeContentProps {
  userId: string;
}

type ReadinessMap = Record<string, CaseReadinessResult | null>;

function StatusBadge({
  readiness,
  loading,
}: {
  readiness: CaseReadinessResult | null | undefined;
  loading?: boolean;
}) {
  const badgeClass = "gap-0.5 px-1.5 py-0 text-xs font-normal";
  if (loading) {
    return (
      <Badge variant="secondary" className={badgeClass}>
        <Loader2 className="size-2.5 animate-spin" />…
      </Badge>
    );
  }
  if (!readiness) return <span className="text-muted-foreground text-xs">—</span>;
  if (readiness.error) {
    return (
      <Badge variant="destructive" className={badgeClass}>
        Error
      </Badge>
    );
  }
  const ready = readiness.userFields && readiness.sourceDocuments;
  if (ready) {
    return (
      <Badge variant="default" className={`${badgeClass} bg-primary`}>
        <Check className="size-2.5" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={badgeClass}>
      <FileStack className="size-2.5" />
      Not ready
    </Badge>
  );
}

export function CasesHomeContent({ userId }: CasesHomeContentProps) {
  const router = useRouter();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readinessMap, setReadinessMap] = useState<ReadinessMap>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [caseName, setCaseName] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [downloadAllDialogOpen, setDownloadAllDialogOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = listenToCases(
      userId,
      20,
      (updatedCases) => {
        setCases(updatedCases);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to cases:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (cases.length === 0) return;
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        cases.map(async (c) => {
          const result = await checkCaseReadiness(c.caseId);
          return [c.caseId, result] as const;
        })
      );
      if (cancelled) return;
      setReadinessMap(Object.fromEntries(entries));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [cases]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!caseName.trim()) {
      setCreateError("Please enter a case name");
      return;
    }
    setCreateLoading(true);
    try {
      const result = await createCase(caseName);
      if (result.success && result.caseId) {
        setDialogOpen(false);
        setCaseName("");
        router.push(`/cases/${result.caseId}`);
      } else {
        setCreateError(result.error || "Failed to create case");
      }
    } catch (err) {
      setCreateError("An unexpected error occurred");
      console.error("Error creating case:", err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!createLoading) {
      setDialogOpen(open);
      if (!open) {
        setCaseName("");
        setSelectedState("");
        setCreateError(null);
      }
    }
  };

  if (error) {
    return (
      <Card className="border-destructive/50 w-full max-w-md">
        <CardContent className="p-4 pt-6 sm:p-6">
          <p className="text-destructive font-medium">Error loading cases</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 p-4 bg-accent rounded-xl sm:gap-6 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] lg:gap-8 lg:p-16">
      <div className="space-y-5 bg-background rounded-xl p-4 sm:space-y-6 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl leading-relaxed">
            Handle post-death paperwork in minutes.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base leading-relaxed">
            Upload a death certificate. We securely extract the details and generate ready-to-send
            documents for banks, government offices, and institutions.
          </p>
        </div>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <FileUp className="size-4 text-muted-foreground" />
            </span>
            <span>Upload death certificate</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <ShieldCheck className="size-4 text-muted-foreground" />
            </span>
            <span>We extract details securely</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Download className="size-4 text-muted-foreground" />
            </span>
            <span>Download formatted documents</span>
          </li>
        </ul>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <Button className="w-full" size="lg" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Start New Case
          </Button>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateCase}>
              <DialogHeader>
                <DialogTitle>New Case</DialogTitle>
                <DialogDescription>
                  Create a new case to begin processing documents.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="case-name">Case Name</Label>
                  <Input
                    id="case-name"
                    placeholder="Enter case name"
                    value={caseName}
                    onChange={(e) => setCaseName(e.target.value)}
                    disabled={createLoading}
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label>State</Label>
                  <Select
                    value={selectedState || undefined}
                    onValueChange={setSelectedState}
                    disabled={createLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading || !caseName.trim()}>
                  {createLoading ? "Creating…" : "Create Case"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-4 shrink-0 rounded-full bg-muted p-0.5" />
          Your documents are encrypted and never shared with anyone.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-3 sm:p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center p-4 sm:p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia>
                    <div className="flex -space-x-2 *:data-[slot=avatar]:size-8 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale">
                      <Avatar>
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarFallback>MS</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarFallback>AJ</AvatarFallback>
                      </Avatar>
                    </div>
                  </EmptyMedia>
                  <EmptyTitle className="mt-4">You are not alone</EmptyTitle>
                  <EmptyDescription>
                    3.3 million American families face <br />
                    this crisis every year.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <p className="text-xs text-muted-foreground">
                    We&apos;re building the solution to help families like yours.
                  </p>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <ItemGroup className="gap-3 px-3 pb-3 pt-0 sm:px-6">
              {cases.map((caseItem) => {
                const readiness = readinessMap[caseItem.caseId];
                const ready =
                  readiness &&
                  !readiness.error &&
                  readiness.userFields &&
                  readiness.sourceDocuments;
                const isLoadingReadiness =
                  cases.length > 0 && readinessMap[caseItem.caseId] === undefined;
                return (
                  <Item
                    key={caseItem.caseId}
                    variant="outline"
                    className="relative flex-wrap items-start gap-2 sm:items-center hover:bg-muted/50"
                  >
                    <Link
                      href={`/cases/${caseItem.caseId}`}
                      className="absolute inset-0 z-10 rounded-lg"
                      aria-label={`Open case ${caseItem.name}`}
                    />
                    <ItemMedia variant="icon" className="shrink-0">
                      <FolderOpen className="size-4 text-muted-foreground" />
                    </ItemMedia>
                    <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-start gap-2 sm:flex sm:items-center">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="truncate text-sm font-medium">
                          {caseItem.name}
                        </ItemTitle>
                        <ItemDescription className="mt-0">
                          <span className="text-xs">{formatRelativeTime(caseItem.updatedAt)}</span>
                        </ItemDescription>
                      </ItemContent>
                      <StatusBadge readiness={readiness} loading={isLoadingReadiness} />
                    </div>
                    <ItemActions className="relative z-20 w-full min-w-full shrink-0 flex-wrap justify-start gap-2 pt-2 sm:ml-auto sm:w-auto sm:min-w-0 sm:justify-end sm:pt-0">
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={!ready}
                        onClick={() => setDownloadAllDialogOpen(true)}
                        className="order-2 sm:order-1"
                      >
                        Download All
                      </Button>
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
      <Dialog open={downloadAllDialogOpen} onOpenChange={setDownloadAllDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>We&apos;re building this</DialogTitle>
            <DialogDescription>
              You will get notified when this feature is generally available.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
