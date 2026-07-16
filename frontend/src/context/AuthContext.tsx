import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setLogoutCallback } from "../lib/apiClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const storedToken = localStorage.getItem("nexus_token");
    const storedUser = localStorage.getItem("nexus_user");

    if (storedToken && storedUser) {
      try {
        // Decode JWT payload locally to check for expiration
        const payloadBase64 = storedToken.split(".")[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          console.warn("[AUTH] Stored token has expired. Clearing session.");
          localStorage.removeItem("nexus_token");
          localStorage.removeItem("nexus_user");
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("[AUTH] Error decoding stored token. Clearing session:", e);
        localStorage.removeItem("nexus_token");
        localStorage.removeItem("nexus_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("nexus_token", newToken);
    localStorage.setItem("nexus_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("nexus_token");
    localStorage.removeItem("nexus_user");
  };

  // Register logout callback for the apiClient
  useEffect(() => {
    setLogoutCallback(logout);
  }, []);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
