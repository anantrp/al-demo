"use client";

import * as React from "react";

export type UserData = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

const UserContext = React.createContext<UserData | null>(null);

export function UserProvider({ user, children }: { user: UserData; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  const user = React.useContext(UserContext);
  if (!user) {
    throw new Error("useUser must be used within UserProvider");
  }
  return user;
}
