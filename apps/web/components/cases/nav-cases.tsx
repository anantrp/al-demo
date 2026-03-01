"use client";

import { useState, useEffect } from "react";
import { FolderOpen, MoreHorizontal } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateCaseDialog } from "./create-case-dialog";
import { listenToCases, getCases, CaseData } from "@/lib/firestore/cases";
import { QueryDocumentSnapshot } from "firebase/firestore";

interface NavCasesProps {
  userId: string;
}

export function NavCases({ userId }: NavCasesProps) {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = listenToCases(
      userId,
      10,
      (updatedCases) => {
        setCases(updatedCases);
        setLoading(false);
        if (updatedCases.length < 10) {
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
      const result = await getCases(userId, 10, lastDoc || undefined);

      if (result.cases.length === 0) {
        setHasMore(false);
      } else {
        setCases((prev) => {
          const existingIds = new Set(prev.map((c) => c.caseId));
          const newCases = result.cases.filter((c) => !existingIds.has(c.caseId));
          return [...prev, ...newCases];
        });
        setLastDoc(result.lastDoc);

        if (result.cases.length < 10) {
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

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Cases</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <CreateCaseDialog />
        </SidebarMenuItem>

        {loading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <SidebarMenuItem key={i}>
                <div className="px-2 py-1.5">
                  <Skeleton className="h-4 w-full" />
                </div>
              </SidebarMenuItem>
            ))}
          </>
        ) : error ? (
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-sm text-red-600 dark:text-red-400">{error}</div>
          </SidebarMenuItem>
        ) : cases.length === 0 ? (
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No cases yet. Create your first case above.
            </div>
          </SidebarMenuItem>
        ) : (
          <>
            {cases.map((caseItem) => (
              <SidebarMenuItem key={caseItem.caseId}>
                <SidebarMenuButton asChild>
                  <a href={`/cases/${caseItem.caseId}`}>
                    <FolderOpen className="size-4" />
                    <span className="truncate">{caseItem.name}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {hasMore && cases.length >= 10 && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-sidebar-foreground/70"
                >
                  <MoreHorizontal className="text-sidebar-foreground/70" />
                  <span>{loadingMore ? "Loading..." : "Load More"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
