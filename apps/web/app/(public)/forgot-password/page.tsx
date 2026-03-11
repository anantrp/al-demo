"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sendPasswordResetEmail, auth } from "@/lib/firebase";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { clearExpiredSession } from "@/actions/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearExpiredSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Failed to send password reset email. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
                  <p className="mb-2">Password reset email sent successfully!</p>
                  <p className="text-xs">
                    Click the link in the email to reset your password. The link will expire in 1
                    hour.
                  </p>
                </div>
              </Field>
              <Field>
                <Button type="button" onClick={() => router.push("/login")} className="w-full">
                  Back to Login
                </Button>
              </Field>
              <Field>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSuccess(false)}
                  className="w-full"
                >
                  Resend Email
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={cn("flex w-full max-w-md flex-col gap-6")}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
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
                    autoFocus
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </Field>
                <Field>
                  <FieldDescription className="text-center">
                    Remember your password?{" "}
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
