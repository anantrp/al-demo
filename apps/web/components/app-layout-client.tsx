"use client";

import { UserProvider } from "@/lib/user-context";
import { Toaster } from "@/components/ui/toaster";
import type { UserData } from "@/lib/user-context";

export function AppLayoutClient({ user, children }: { user: UserData; children: React.ReactNode }) {
  return (
    <UserProvider user={user}>
      {children}
      <Toaster />
    </UserProvider>
  );
}
