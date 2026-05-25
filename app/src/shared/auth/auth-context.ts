import { createContext, useContext } from "react";

import type { CurrentUser } from "@/shared/types";

export type AuthContextValue = {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  refreshCurrentUser(): Promise<CurrentUser | null>;
  setCurrentUser(user: CurrentUser | null): void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
