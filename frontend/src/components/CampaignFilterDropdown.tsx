import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, Search, X, Check, ChevronDown } from "lucide-react";
import { campaignsApi } from "../api/marketing";
import type { Campaign } from "../types/marketing";

interface CampaignFilterDropdownProps {
  selectedCampaignIds: string[];
  onChange: (campaignIds: string[]) => void;
}

export const CampaignFilterDropdown: React.FC<CampaignFilterDropdownProps> = ({
  selectedCampaignIds,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch campaigns for the dropdown list
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ["campaigns-filter-list"],
    queryFn: async () => {
      const res = await campaignsApi.getCampaigns({ limit: 100 });
      return Array.isArray(res) ? res : (res as any)?.data || [];
    }
  });

  const campaigns: Campaign[] = campaignsData || [];

  // Filter campaigns by search term
  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const lower = searchTerm.toLowerCase();
    return campaigns.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.code && c.code.toLowerCase().includes(lower))
    );
  }, [campaigns, searchTerm]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleCampaign = (id: string) => {
    if (selectedCampaignIds.includes(id)) {
      onChange(selectedCampaignIds.filter((cId) => cId !== id));
    } else {
      onChange([...selectedCampaignIds, id]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const isSelected = selectedCampaignIds.length > 0;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
          isSelected
            ? "bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Target className={`w-3.5 h-3.5 ${isSelected ? "text-purple-600 dark:text-purple-400" : "text-slate-500"}`} />
        <span>Campaign</span>
        {isSelected && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-100">
            {selectedCampaignIds.length}
          </span>
        )}
        {isSelected ? (
          <span
            onClick={handleClear}
            title="Clear campaign filter"
            className="p-0.5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2.5 space-y-2 text-left animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full !pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Quick Action Header */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold">
              {selectedCampaignIds.length} selected
            </span>
            {selectedCampaignIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Campaign List */}
          <div className="max-h-56 overflow-y-auto no-scrollbar space-y-1 pr-0.5">
            {isLoading ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading campaigns...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                {searchTerm ? "No matching campaigns" : "No campaigns found"}
              </div>
            ) : (
              filteredCampaigns.map((camp) => {
                const checked = selectedCampaignIds.includes(camp.id);
                return (
                  <div
                    key={camp.id}
                    onClick={() => toggleCampaign(camp.id)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-100"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="truncate">
                        <div className="font-medium truncate">{camp.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {camp.code} • {camp.channel}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        camp.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
