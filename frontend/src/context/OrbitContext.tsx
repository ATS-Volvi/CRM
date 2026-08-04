import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export type OrbitMode = "mission_control" | "team" | "customers" | "sales" | "ai" | "workspace";

interface OrbitAction {
  id: string;
  label: string;
  icon: string; // Lucide icon name or identifier
  badge?: string;
  color?: string;
  action: () => void;
}

interface OrbitContextType {
  mode: OrbitMode;
  setMode: (mode: OrbitMode) => void;
  customActions: OrbitAction[];
  setCustomActions: (actions: OrbitAction[]) => void;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;

  // Workspace Drawers State
  activeLeadId: string | number | null;
  openLeadDrawer: (id: string | number) => void;
  closeLeadDrawer: () => void;

  activeQuoteId: string | number | null;
  openQuoteDrawer: (id?: string | number) => void;
  closeQuoteDrawer: () => void;

  activeInvoiceId: string | number | null;
  openInvoiceDrawer: (id: string | number) => void;
  closeInvoiceDrawer: () => void;

  isCreateLeadOpen: boolean;
  openCreateLeadDrawer: () => void;
  closeCreateLeadDrawer: () => void;
}

const OrbitContext = createContext<OrbitContextType | undefined>(undefined);

export const OrbitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [mode, setMode] = useState<OrbitMode>("mission_control");
  const [customActions, setCustomActions] = useState<OrbitAction[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Drawer States
  const [activeLeadId, setActiveLeadId] = useState<string | number | null>(null);
  const [activeQuoteId, setActiveQuoteId] = useState<string | number | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | number | null>(null);
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);

  const openLeadDrawer = (id: string | number) => setActiveLeadId(id);
  const closeLeadDrawer = () => setActiveLeadId(null);

  const openQuoteDrawer = (id?: string | number) => setActiveQuoteId(id || "new");
  const closeQuoteDrawer = () => setActiveQuoteId(null);

  const openInvoiceDrawer = (id: string | number) => setActiveInvoiceId(id);
  const closeInvoiceDrawer = () => setActiveInvoiceId(null);

  const openCreateLeadDrawer = () => setIsCreateLeadOpen(true);
  const closeCreateLeadDrawer = () => setIsCreateLeadOpen(false);

  // Auto detect contextual orbit mode based on route path
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/salespersons")) {
      setMode("team");
    } else if (path.startsWith("/customers") || path.startsWith("/leads")) {
      setMode("customers");
    } else if (path.startsWith("/pipeline") || path.startsWith("/quotes") || path.startsWith("/invoices") || path.startsWith("/purchase-orders")) {
      setMode("sales");
    } else if (path.startsWith("/ai-reports")) {
      setMode("ai");
    } else if (path.startsWith("/settings") || path.startsWith("/rules") || path.startsWith("/automation") || path.startsWith("/master-data") || path.startsWith("/approvals")) {
      setMode("workspace");
    } else {
      setMode("mission_control");
    }
  }, [location.pathname]);

  return (
    <OrbitContext.Provider
      value={{
        mode,
        setMode,
        customActions,
        setCustomActions,
        activeTabId,
        setActiveTabId,
        activeLeadId,
        openLeadDrawer,
        closeLeadDrawer,
        activeQuoteId,
        openQuoteDrawer,
        closeQuoteDrawer,
        activeInvoiceId,
        openInvoiceDrawer,
        closeInvoiceDrawer,
        isCreateLeadOpen,
        openCreateLeadDrawer,
        closeCreateLeadDrawer,
      }}
    >
      {children}
    </OrbitContext.Provider>
  );
};

export const useOrbit = () => {
  const context = useContext(OrbitContext);
  if (!context) {
    throw new Error("useOrbit must be used within an OrbitProvider");
  }
  return context;
};

