import React, { createContext, useContext, useState, useEffect } from "react";

export type BrandMode = "nexus";
export type ThemeColor = "sky" | "emerald" | "velvet";

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
    if (saved === "sky") return "sky";
    return "emerald"; // Default to FACE Light Green
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
    if (themeColor === "emerald" || themeColor === "velvet") {
      document.documentElement.classList.add("theme-emerald");
      document.documentElement.classList.remove("theme-sky");
    } else {
      document.documentElement.classList.add("theme-sky");
      document.documentElement.classList.remove("theme-emerald");
    }
  }, [themeColor]);

  const isGreen = themeColor === "emerald" || themeColor === "velvet";

  const brand: BrandConfig = {
    mode: "nexus",
    isEnergia: false,
    isNexus: true,
    appName: "NEXUS CRM",
    tagline: "Workspace OS",
    logoUrl: null,
    primaryColor: isGreen ? "#059669" : "#2563EB",
    badgeText: "NX",
    badgeGradient: isGreen
      ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] shadow-emerald-500/20"
      : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20",
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
