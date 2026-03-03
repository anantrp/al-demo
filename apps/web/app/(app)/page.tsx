import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { verifySession } from "@/actions/auth";
import { CasesHomeContent } from "@/components/cases/cases-home-content";
import { NavActions } from "@/components/nav-actions";
import { GalleryVerticalEnd } from "lucide-react";

export default async function DashboardPage() {
  const user = await verifySession();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:h-16 sm:px-4">
        <div className="flex flex-1 items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/" className="flex items-center gap-1.5">
                    <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                      <GalleryVerticalEnd className="size-4" />
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Cases</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto px-3">
          <NavActions />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-auto">
        <div className="mx-auto w-full max-w-6xl gap-4 p-4">
          <CasesHomeContent userId={user.uid} />
        </div>
      </div>
    </div>
  );
}
