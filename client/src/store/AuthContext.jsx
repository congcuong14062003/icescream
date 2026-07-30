import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrateUser = useCallback(async () => {
    const response = await api.get("/auth/me");
    setUser(response.data.data);
    return response.data.data;
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      if (!getAccessToken()) {
        await refreshAccessToken();
      }
      const nextUser = await hydrateUser();
      connectSocket(getAccessToken(), nextUser.branch?.id);
      return true;
    } catch {
      disconnectSocket();
      setAccessToken(null);
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, [hydrateUser]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const handleExpired = () => {
      disconnectSocket();
      setUser(null);
    };
    window.addEventListener("icecream:session-expired", handleExpired);
    return () => window.removeEventListener("icecream:session-expired", handleExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    const { accessToken, user: nextUser } = response.data.data;
    setAccessToken(accessToken);
    setUser(nextUser);
    connectSocket(accessToken, nextUser.branch?.id);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      disconnectSocket();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => hydrateUser(), [hydrateUser]);

  const hasPermission = useCallback(
    (...permissions) =>
      user?.role?.code === "ADMIN" ||
      permissions.some((permission) => user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, hasPermission }),
    [user, loading, login, logout, refreshUser, hasPermission],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
