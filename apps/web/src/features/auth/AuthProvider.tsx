import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { restoreSession, login as loginRequest, logout as logoutRequest } from "../../lib/api/client";
import type { AuthUser } from "../../lib/api/client";
import { useApiMode } from "../api-mode/ApiModeProvider";

type AuthValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (userName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  has: (role: string) => boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

const LOCAL_BACKEND_USER: AuthUser = {
  id: "local-development",
  user_name: "local-development",
  roles: ["ADMIN"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { mode, isLocalBackend } = useApiMode();

  const { data, isLoading: isSessionLoading } = useQuery({
    queryKey: ["me", mode],
    queryFn: restoreSession,
    enabled: !isLocalBackend,
    retry: false,
  });

  const signIn = useMutation({
    mutationFn: ({ userName, password }: { userName: string; password: string }) =>
      loginRequest(userName, password),
    onSuccess: (user) => queryClient.setQueryData(["me", mode], user),
  });

  const signOut = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["me", mode], null);
      queryClient.removeQueries({ queryKey: ["calendars"] });
    },
  });

  const user = isLocalBackend ? LOCAL_BACKEND_USER : (data ?? null);

  const value: AuthValue = {
    user,
    isLoading: isLocalBackend ? false : isSessionLoading,
    signIn: async (userName, password) => {
      await signIn.mutateAsync({ userName, password });
    },
    signOut: async () => {
      if (!isLocalBackend) await signOut.mutateAsync();
    },
    // ADMIN is a superset of the other roles, matching the server-side guard.
    has: (role) => !!user && (user.roles.includes(role) || user.roles.includes("ADMIN")),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
