"use server";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

export async function createSession(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  try {
    const decodedIdToken = await adminAuth.verifyIdToken(idToken);

    if (new Date().getTime() / 1000 - decodedIdToken.auth_time! > 5 * 60) {
      throw new Error("Recent sign-in required");
    }

    // Require email verification for password sign-ins
    const signInProvider = decodedIdToken.firebase?.sign_in_provider;
    if (signInProvider === "password" && !decodedIdToken.email_verified) {
      return { success: false, error: "Please verify your email before signing in." };
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating session:", error);
    return { success: false, error: "Failed to create session" };
  }
}

export async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return null;
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true);
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email || null,
      name: decodedClaims.name || null,
      picture: decodedClaims.picture || null,
    };
  } catch (error: unknown) {
    console.error("Error verifying session:", (error as Error).message);
    cookieStore.delete("session");
    return null;
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (session) {
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(session);
      await adminAuth.revokeRefreshTokens(decodedClaims.uid);
    } catch (error: unknown) {
      console.error("Error revoking tokens:", (error as Error).message);
    }
  }

  cookieStore.delete("session");
  return { success: true };
}
