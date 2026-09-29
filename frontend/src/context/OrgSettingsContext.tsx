import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { setGlobalOrgCurrency } from "../utils/currency";
import { useAuth } from "./AuthContext";

interface OrgSettingsContextType {
  defaultCurrency: string;
  isLoading: boolean;
  refetch: () => void;
  updateOrgCurrency: (currency: string) => Promise<void>;
}

const OrgSettingsContext = createContext<OrgSettingsContextType>({
  defaultCurrency: "SAR",
  isLoading: false,
  refetch: () => {},
  updateOrgCurrency: async () => {},
});

export const OrgSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [defaultCurrency, setDefaultCurrency] = useState<string>("SAR");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orgSettings"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/settings/org");
      return res;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.defaultCurrency) {
      setDefaultCurrency(data.defaultCurrency);
      setGlobalOrgCurrency(data.defaultCurrency);
    }
  }, [data]);

  const updateOrgCurrency = async (newCurrency: string) => {
    const res = await apiClient.put("/api/v1/settings/org", { defaultCurrency: newCurrency });
    if (res?.defaultCurrency) {
      setDefaultCurrency(res.defaultCurrency);
      setGlobalOrgCurrency(res.defaultCurrency);
      refetch();
    }
  };

  return (
    <OrgSettingsContext.Provider
      value={{
        defaultCurrency,
        isLoading,
        refetch,
        updateOrgCurrency,
      }}
    >
      {children}
    </OrgSettingsContext.Provider>
  );
};

export const useOrgCurrency = () => {
  const context = useContext(OrgSettingsContext);
  return context;
};
