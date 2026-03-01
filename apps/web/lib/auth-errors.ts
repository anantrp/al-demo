/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Use this to avoid showing raw Firebase error strings like
 * "Firebase: Error (auth/email-already-in-use)." to users.
 */
const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "This email is already in use",
  "auth/invalid-email": "Please enter a valid email address",
  "auth/user-disabled": "This account has been disabled",
  "auth/user-not-found": "No account found with this email address",
  "auth/wrong-password": "Incorrect password",
  "auth/invalid-credential": "Invalid email or password",
  "auth/invalid-login-credentials": "Invalid email or password",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/operation-not-allowed": "This sign-in method is not enabled",
  "auth/weak-password": "Password is too weak. Please choose a stronger password",
  "auth/expired-action-code": "This link has expired. Please request a new one.",
  "auth/invalid-action-code": "This link is invalid or has already been used.",
  "auth/popup-closed-by-user": "Sign-in was cancelled",
  "auth/cancelled-popup-request": "Sign-in was cancelled",
  "auth/account-exists-with-different-credential":
    "An account already exists with the same email but a different sign-in method",
  "auth/credential-already-in-use":
    "This credential is already associated with a different account",
  "auth/requires-recent-login": "Please sign in again to complete this action",
  "auth/network-request-failed": "Network error. Please check your connection and try again",
  "auth/popup-blocked": "Popup was blocked by the browser. Please allow popups and try again",
  "auth/email-change-needs-verification": "Please verify your new email address",
};

/**
 * Extracts the Firebase Auth error code from an error.
 * Firebase errors have a `code` property. The raw message may also contain
 * the code in format "Firebase: Error (auth/xxx)." - we try both.
 */
function getErrorCode(err: unknown): string | null {
  const code = (err as { code?: string }).code;
  if (typeof code === "string" && code.startsWith("auth/")) {
    return code;
  }
  const message = (err as Error).message;
  if (typeof message === "string") {
    const match = message.match(/auth\/[a-z-]+/);
    return match ? match[0] : null;
  }
  return null;
}

/**
 * Returns a user-friendly message for a Firebase Auth error.
 * Falls back to the provided defaultMessage if the error is not a known Firebase auth error.
 */
export function getAuthErrorMessage(
  err: unknown,
  defaultMessage: string = "Something went wrong. Please try again"
): string {
  const code = getErrorCode(err);
  if (code && FIREBASE_AUTH_ERROR_MESSAGES[code]) {
    return FIREBASE_AUTH_ERROR_MESSAGES[code];
  }
  return defaultMessage;
}
