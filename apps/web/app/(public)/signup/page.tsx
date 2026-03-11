import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/signup-form";
import { verifySession } from "@/actions/auth";

export default async function SignupPage() {
  const user = await verifySession();

  if (user) {
    redirect("/");
  }

  return (
    <div className="bg-muted flex min-h-full flex-col items-center justify-center overflow-auto gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          AL Demo
        </Link>
        <SignupForm />
      </div>
    </div>
  );
}
