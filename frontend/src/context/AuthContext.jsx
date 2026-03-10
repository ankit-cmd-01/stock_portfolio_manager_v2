import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_STORAGE_KEY, buildAuthUser, readStoredAuthUser } from "../utils/authUser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredAuthUser);

  useEffect(() => {
    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = ({ email }) => {
    const nextUser = buildAuthUser({ email, name: String(email || "").split("@")[0] });
    setUser(nextUser);
    return nextUser;
  };

  const register = ({ name, email }) => {
    const nextUser = buildAuthUser({ name, email });
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user?.email),
      login,
      register,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};

export default AuthContext;
