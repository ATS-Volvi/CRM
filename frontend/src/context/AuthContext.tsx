import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setLogoutCallback } from "../lib/apiClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  territory?: string;
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
    // Check sessionStorage on mount (new browser window/tab forces login)
    const storedToken = sessionStorage.getItem("nexus_token");
    const storedUser = sessionStorage.getItem("nexus_user");

    if (storedToken && storedUser) {
      try {
        // Decode JWT payload safely handling Base64URL formatting for Safari/WebKit
        const payloadBase64 = storedToken.split(".")[1];
        let base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4 !== 0) {
          base64 += "=";
        }
        const payloadJson = decodeURIComponent(
          escape(atob(base64))
        );
        const payload = JSON.parse(payloadJson);
        
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          console.warn("[AUTH] Stored token has expired. Clearing session.");
          sessionStorage.removeItem("nexus_token");
          sessionStorage.removeItem("nexus_user");
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("[AUTH] Error decoding stored token. Clearing session:", e);
        sessionStorage.removeItem("nexus_token");
        sessionStorage.removeItem("nexus_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem("nexus_token", newToken);
    sessionStorage.setItem("nexus_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem("nexus_token");
    sessionStorage.removeItem("nexus_user");
  };

  // Session inactivity timeout timer (10 minutes of inactivity)
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.warn("[AUTH] Session timed out due to inactivity.");
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [token]);

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
