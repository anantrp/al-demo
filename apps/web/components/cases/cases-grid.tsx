"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, MoreHorizontal } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listenToCases, getCases, CaseData } from "@/lib/firestore/cases";
import { QueryDocumentSnapshot } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCase } from "@/actions/cases";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CasesGridProps {
  userId: string;
}

export function CasesGrid({ userId }: CasesGridProps) {
  const router = useRouter();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [caseName, setCaseName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = listenToCases(
      userId,
      20,
      (updatedCases) => {
        setCases(updatedCases);
        setLoading(false);
        if (updatedCases.length < 20) {
          setHasMore(false);
        }
      },
      (err) => {
        console.error("Error listening to cases:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const handleLoadMore = async () => {
    if (!lastDoc && cases.length > 0) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await getCases(userId, 20, lastDoc || undefined);

      if (result.cases.length === 0) {
        setHasMore(false);
      } else {
        setCases((prev) => {
          const existingIds = new Set(prev.map((c) => c.caseId));
          const newCases = result.cases.filter((c) => !existingIds.has(c.caseId));
          return [...prev, ...newCases];
        });
        setLastDoc(result.lastDoc);

        if (result.cases.length < 20) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading more cases:", err);
      setError("Failed to load more cases");
    } finally {
      setLoadingMore(false);
    }
  };

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

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!createLoading) {
      setDialogOpen(newOpen);
      if (!newOpen) {
        setCaseName("");
        setCreateError(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:gap-6 cases-grid-cols">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <Skeleton className="size-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-5 w-full max-w-[200px]" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <Skeleton className="h-4 w-24 mt-auto" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="border-destructive/50 max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Error Loading Cases</CardTitle>
            <CardDescription className="mt-2">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (cases.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="bg-muted/50 p-4 rounded-full mb-4">
          <FolderOpen className="size-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No Cases Yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create your first case to start processing documents and managing your workflow.
        </p>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="size-4 mr-2" />
              Create Your First Case
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateCase}>
              <DialogHeader>
                <DialogTitle>Create Case</DialogTitle>
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
                {createError && <div className="text-sm text-destructive">{createError}</div>}
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
                  {createLoading ? "Creating..." : "Create Case"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:gap-6 cases-grid-cols">
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all border-dashed border-2 overflow-hidden">
              <CardHeader className="h-full min-h-[160px] md:min-h-[180px] flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="bg-primary/10 text-primary p-3 rounded-full transition-transform hover:scale-110">
                    <Plus className="size-6 md:size-8" />
                  </div>
                  <div>
                    <CardTitle className="text-base md:text-lg">Create New Case</CardTitle>
                    <CardDescription className="mt-1 text-xs md:text-sm">
                      Start processing documents
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateCase}>
              <DialogHeader>
                <DialogTitle>Create Case</DialogTitle>
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
                {createError && <div className="text-sm text-destructive">{createError}</div>}
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
                  {createLoading ? "Creating..." : "Create Case"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {cases.map((caseItem) => (
          <Card
            key={caseItem.caseId}
            className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group overflow-hidden"
            onClick={() => router.push(`/cases/${caseItem.caseId}`)}
          >
            <CardHeader className="h-full min-h-[160px] md:min-h-[180px] flex flex-col justify-between p-5 md:p-6">
              <div className="flex items-start gap-3 flex-1">
                <div className="bg-primary/10 text-primary p-2 md:p-2.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <FolderOpen className="size-5 md:size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base md:text-lg font-semibold line-clamp-2 wrap-break-word">
                    {caseItem.name}
                  </CardTitle>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardDescription className="mt-auto pt-4 text-xs md:text-sm cursor-default">
                      {formatRelativeTime(caseItem.updatedAt)}
                    </CardDescription>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatDateTime(caseItem.updatedAt)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
          </Card>
        ))}
      </div>

      {hasMore && cases.length >= 20 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} size="lg">
            <MoreHorizontal className="size-4 mr-2" />
            {loadingMore ? "Loading..." : "Load More Cases"}
          </Button>
        </div>
      )}
    </div>
  );
}
