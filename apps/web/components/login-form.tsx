"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendSignInLinkToEmail,
  signOutFromFirebase,
} from "@/lib/firebase";
import { createSession } from "@/actions/auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const EMAIL_FOR_SIGN_IN_KEY = "emailForSignIn";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        await signOutFromFirebase(auth);
        setError(
          "Please verify your email before signing in. Check your inbox for the verification link."
        );
        return;
      }

      const idToken = await userCredential.user.getIdToken();
      const result = await createSession(idToken);

      if (result.success) {
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

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const idToken = await userCredential.user.getIdToken();

      const result = await createSession(idToken);

      if (result.success) {
        router.push("/");
      } else {
        setError(result.error || "Failed to create session");
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Failed to sign in with Google"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const actionCodeSettings = {
        url: typeof window !== "undefined" ? `${window.location.origin}/auth/finish-signin` : "",
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
      setMagicLinkSent(true);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Failed to send magic link"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Login with your Google account or email</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {error && (
              <Field>
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                  {error}
                </div>
              </Field>
            )}
            <Field>
              <Button
                variant="outline"
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4 mr-2">
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
                Login with Google
              </Button>
            </Field>
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
              Or continue with email
            </FieldSeparator>

            {/* Sign-in mode tabs */}
            <Field>
              <div className="flex rounded-lg border p-1 bg-muted/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                    setMagicLinkSent(false);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    mode === "password"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("magic");
                    setError(null);
                    setMagicLinkSent(false);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    mode === "magic"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Magic link
                </button>
              </div>
            </Field>

            {mode === "password" ? (
              <form onSubmit={handleEmailLogin}>
                <FieldGroup>
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
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <a
                        href="/forgot-password"
                        className="ml-auto text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </a>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? "Logging in..." : "Login"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            ) : (
              <form onSubmit={handleSendMagicLink}>
                <FieldGroup>
                  {magicLinkSent ? (
                    <Field>
                      <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
                        Check your inbox at <strong>{email}</strong>. Click the link in the email to
                        sign in.
                      </div>
                      <FieldDescription className="mt-2">
                        Didn&apos;t receive it? Check spam or{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setMagicLinkSent(false)}
                        >
                          try again
                        </button>
                      </FieldDescription>
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="magic-email">Email</FieldLabel>
                        <Input
                          id="magic-email"
                          type="email"
                          placeholder="m@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                        />
                        <FieldDescription>
                          We&apos;ll send you a sign-in link—no password needed
                        </FieldDescription>
                      </Field>
                      <Field>
                        <Button type="submit" disabled={loading} className="w-full">
                          {loading ? "Sending link..." : "Send magic link"}
                        </Button>
                      </Field>
                    </>
                  )}
                </FieldGroup>
              </form>
            )}

            <Field>
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <a href="/signup" className="underline">
                  Sign up
                </a>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
