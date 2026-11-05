import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { restoreSession, login as loginRequest, logout as logoutRequest } from "../../lib/api/client";
import type { AuthUser } from "../../lib/api/client";

type AuthValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (userName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  has: (role: string) => boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: restoreSession,
    retry: false,
  });

  const signIn = useMutation({
    mutationFn: ({ userName, password }: { userName: string; password: string }) =>
      loginRequest(userName, password),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });

  const signOut = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
      queryClient.removeQueries({ queryKey: ["calendars"] });
    },
  });

  const user = data ?? null;

  const value: AuthValue = {
    user,
    isLoading,
    signIn: async (userName, password) => {
      await signIn.mutateAsync({ userName, password });
    },
    signOut: async () => {
      await signOut.mutateAsync();
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
