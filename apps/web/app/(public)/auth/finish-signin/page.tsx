"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { auth, isSignInWithEmailLink, signInWithEmailLink } from "@/lib/firebase";
import { createSession, clearExpiredSession, verifySession } from "@/actions/auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const EMAIL_FOR_SIGN_IN_KEY = "emailForSignIn";

function FinishSignInContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkExistingSession = async () => {
      const user = await verifySession();
      if (user) {
        router.push("/");
        return true;
      }
      return false;
    };

    const completeSignIn = async () => {
      const hasSession = await checkExistingSession();
      if (hasSession) return;

      await clearExpiredSession();
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError("Invalid or missing sign-in link.");
        setInvalidLink(true);
        setVerifying(false);
        return;
      }

      const signInEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);

      if (!signInEmail) {
        setVerifying(false);
        setNeedsEmail(true);
        setError("Enter your email to complete sign-in (link was opened on a different device).");
        return;
      }

      setVerifying(true);
      setError(null);

      try {
        const userCredential = await signInWithEmailLink(auth, signInEmail, window.location.href);
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);

        const idToken = await userCredential.user.getIdToken();
        const result = await createSession(idToken);

        if (result.success) {
          window.history.replaceState({}, "", "/auth/finish-signin");
          router.push("/");
        } else {
          setError(result.error || "Failed to create session");
        }
      } catch (err: unknown) {
        setError(getAuthErrorMessage(err, "Failed to sign in with magic link"));
      } finally {
        setVerifying(false);
      }
    };

    completeSignIn();
  }, [router]);

  const handleCompleteWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);

      const idToken = await userCredential.user.getIdToken();
      const result = await createSession(idToken);

      if (result.success) {
        window.history.replaceState({}, "", "/auth/finish-signin");
        router.push("/");
      } else {
        setError(result.error || "Failed to create session");
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Failed to sign in"));
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="bg-muted flex min-h-full flex-col items-center justify-center overflow-auto gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Verifying your sign-in link...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="bg-muted flex min-h-full flex-col items-center justify-center overflow-auto gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 self-center font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            AL Demo
          </Link>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Invalid link</CardTitle>
              <CardDescription>This sign-in link is invalid or has expired</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <Button asChild className="w-full">
                    <a href="/login">Back to login</a>
                  </Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted flex min-h-full flex-col items-center justify-center overflow-auto gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          AL Demo
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Complete sign-in</CardTitle>
            <CardDescription>
              {needsEmail
                ? "Enter the email address where you received the sign-in link"
                : "Finishing your sign-in..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompleteWithEmail}>
              <FieldGroup>
                {error && (
                  <Field>
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                      {error}
                    </div>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Signing in..." : "Complete sign-in"}
                  </Button>
                </Field>
                <Field>
                  <FieldDescription className="text-center">
                    <a href="/login" className="underline">
                      Back to login
                    </a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function FinishSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-muted flex min-h-full flex-col items-center justify-center overflow-auto gap-6 p-6 md:p-10">
          <div className="w-full max-w-sm">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <FinishSignInContent />
    </Suspense>
  );
}
