import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { Building2, TrendingUp, Users, ArrowUpRight, Search, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function Accounts() {
  const [search, setSearch] = useState("");

  const { data: accountsData, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/accounts");
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Failed to fetch accounts (${res.status})`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const accounts = useMemo(() => {
    return Array.isArray(accountsData) ? accountsData : [];
  }, [accountsData]);

  const totalValue = useMemo(() => {
    return accounts.reduce((sum: number, acc: any) => {
      const deals = Array.isArray(acc.deals) ? acc.deals : Array.isArray(acc.Deals) ? acc.Deals : [];
      const accountDealsSum = deals.reduce((ds: number, d: any) => ds + (Number(d.amount) || 0), 0);
      return sum + accountDealsSum;
    }, 0);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((acc: any) => {
      const name = (acc.name || "").toLowerCase();
      const industry = (acc.industry || "").toLowerCase();
      const primaryContact = (acc.primaryContactName || "").toLowerCase();
      return name.includes(q) || industry.includes(q) || primaryContact.includes(q);
    });
  }, [accounts, search]);

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col justify-center items-center h-96 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-xs font-bold text-slate-500">Loading Customer Accounts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <div>
          <h3 className="text-base font-bold text-rose-900">Failed to Load Accounts</h3>
          <p className="text-xs text-rose-700 mt-1">{(error as any).message || "An error occurred while fetching customer accounts."}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Customer Accounts
          </h1>
          <p className="text-slate-500 mt-1 text-xs font-medium">
            Manage B2B customer records, track active opportunity pipelines, and view key stakeholders.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts or contacts..." 
            className="pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 shadow-2xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all w-64 focus:w-80"
          />
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Accounts</p>
              <h2 className="text-2xl font-black text-slate-900 mt-0.5">{accounts.length}</h2>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Pipeline Value</p>
              <h2 className="text-2xl font-black text-emerald-700 mt-0.5">
                {formatCurrency(totalValue)}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white border border-slate-200/80 shadow-2xs rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account Name</th>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Primary Contact</th>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Deals</th>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pipeline Value</th>
              <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredAccounts.map((account: any) => {
              const deals = Array.isArray(account.deals) ? account.deals : Array.isArray(account.Deals) ? account.Deals : [];
              const contacts = Array.isArray(account.contacts) ? account.contacts : [];
              const accountDealsValue = deals.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
              const nameInitial = (account.name || "A").trim().charAt(0).toUpperCase();

              return (
                <tr key={account.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-white shadow-2xs group-hover:scale-105 transition-transform">
                        <span className="text-indigo-700 font-extrabold text-base">{nameInitial}</span>
                      </div>
                      <div className="ml-4">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {account.name || "Untitled Account"}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          Created {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Recently'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {contacts.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                          {(contacts[0].firstName || '').charAt(0)}{(contacts[0].lastName || '').charAt(0)}
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {contacts[0].firstName} {contacts[0].lastName}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        {account.primaryContactName || "No contact listed"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 inline-flex text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {deals.length} Deals
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-xs font-extrabold text-slate-900">
                    {formatCurrency(accountDealsValue)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 font-bold">
                      <span>View Account</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredAccounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 italic">
                  {search ? `No accounts matching "${search}"` : "No customer accounts found. Accounts will automatically link as leads get qualified."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
