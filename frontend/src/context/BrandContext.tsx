import React, { createContext, useContext, useState, useEffect } from "react";

export type BrandMode = "nexus";
export type ThemeColor = "sky" | "velvet";

export interface BrandConfig {
  mode: BrandMode;
  isEnergia: boolean;
  isNexus: boolean;
  appName: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  badgeText: string;
  badgeGradient: string;
}

interface BrandContextType {
  brandMode: BrandMode;
  setBrandMode: (mode: BrandMode) => void;
  brand: BrandConfig;
  themeColor: ThemeColor;
  setThemeColor: (theme: ThemeColor) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem("sidebar_theme");
    return saved === "velvet" ? "velvet" : "sky";
  });

  const setThemeColor = (theme: ThemeColor) => {
    setThemeColorState(theme);
    localStorage.setItem("sidebar_theme", theme);
  };

  const brandMode: BrandMode = "nexus";
  const setBrandMode = () => {};

  useEffect(() => {
    document.title = "Nexus CRM | Workspace OS";
  }, []);

  useEffect(() => {
    if (themeColor === "velvet") {
      document.documentElement.classList.add("theme-velvet");
      document.documentElement.classList.remove("theme-sky");
    } else {
      document.documentElement.classList.add("theme-sky");
      document.documentElement.classList.remove("theme-velvet");
    }
  }, [themeColor]);

  const brand: BrandConfig = {
    mode: "nexus",
    isEnergia: false,
    isNexus: true,
    appName: "NEXUS CRM",
    tagline: "Workspace OS",
    logoUrl: null,
    primaryColor: themeColor === "velvet" ? "#9F1239" : "#2563EB",
    badgeText: "NX",
    badgeGradient: "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20",
  };

  return (
    <BrandContext.Provider value={{ brandMode, setBrandMode, brand, themeColor, setThemeColor }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = (): BrandContextType => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
};
