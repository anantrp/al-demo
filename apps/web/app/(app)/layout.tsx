import { redirect } from "next/navigation";
import { verifySession } from "@/actions/auth";
import { AppLayoutClient } from "@/components/app-layout-client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();

  if (!user) {
    redirect("/login");
  }

  return <AppLayoutClient user={user}>{children}</AppLayoutClient>;
}
