"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type UserData = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export function AppLayoutClient({ user, children }: { user: UserData; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
