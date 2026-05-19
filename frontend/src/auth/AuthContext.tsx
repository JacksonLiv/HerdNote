import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchMe, logout as apiLogout, type Me } from "../api/client";

interface AuthState {
  user: Me | null;
  loading: boolean;
  setUser: (u: Me | null) => void;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
