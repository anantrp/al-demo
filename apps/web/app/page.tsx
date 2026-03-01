import { redirect } from "next/navigation";
import { verifySession } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const user = await verifySession();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <main className="flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-lg">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">AL Demo</h1>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Intelligent Document Processing
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl">
            Extract, validate, and generate documents with AI-powered workflows
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
