"use client";

import { useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface ApiUserInfo {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  auth_time?: number;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUserInfo, setApiUserInfo] = useState<ApiUserInfo | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fetchingApi, setFetchingApi] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        await fetchUserInfoFromApi(currentUser);
      } else {
        setApiUserInfo(null);
        setApiError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserInfoFromApi = async (currentUser: User) => {
    setFetchingApi(true);
    setApiError(null);

    try {
      const idToken = await currentUser.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const response = await fetch(`${apiUrl}/me`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setApiUserInfo(data);
    } catch (error) {
      console.error("Error fetching user info from API:", error);
      setApiError(error instanceof Error ? error.message : "Failed to fetch user info from API");
    } finally {
      setFetchingApi(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          {loading ? (
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          ) : user ? (
            <div className="flex flex-col gap-4 items-center sm:items-start w-full">
              <div className="w-full p-6 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Firebase Client Info
                </h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>Name:</strong> {user.displayName || "N/A"}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>UID:</strong> {user.uid}
                </p>
              </div>

              <div className="w-full p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <h2 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">
                  FastAPI Backend Info
                </h2>
                {fetchingApi ? (
                  <p className="text-sm text-blue-700 dark:text-blue-300">Fetching from API...</p>
                ) : apiError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {apiError}
                  </div>
                ) : apiUserInfo ? (
                  <div className="space-y-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Email:</strong> {apiUserInfo.email}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Name:</strong> {apiUserInfo.name || "N/A"}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>UID:</strong> {apiUserInfo.uid}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Email Verified:</strong> {apiUserInfo.email_verified ? "Yes" : "No"}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-4">
                      ✓ Successfully verified with FastAPI backend!
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    No data received from API
                  </p>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-white transition-colors hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="flex h-12 items-center justify-center gap-3 rounded-full bg-white border-2 border-zinc-300 px-6 text-zinc-900 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
