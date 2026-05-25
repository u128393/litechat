import { useEffect, useMemo, useState } from "react";

import { apiFetch, readJson } from "@/shared/api-client";
import { AuthContext, type AuthContextValue } from "@/shared/auth/auth-context";
import type { CurrentUser } from "@/shared/types";

type AuthMeResponse = {
  user?: CurrentUser;
};

async function fetchCurrentUser() {
  try {
    const response = await apiFetch("/api/auth/me");

    if (!response.ok) {
      return null;
    }

    const payload = await readJson<AuthMeResponse>(response);
    return payload?.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshCurrentUser() {
    const nextUser = await fetchCurrentUser();
    setCurrentUser(nextUser);
    return nextUser;
  }

  useEffect(() => {
    let active = true;

    void fetchCurrentUser()
      .then((nextUser) => {
        if (active) {
          setCurrentUser(nextUser);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isLoading,
      refreshCurrentUser,
      setCurrentUser
    }),
    [currentUser, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
