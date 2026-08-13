import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { Building2, TrendingUp, Users, ArrowUpRight, Search } from "lucide-react";

export default function Accounts() {
  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/accounts");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-6">Error loading accounts</div>;
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Accounts
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Manage your B2B accounts, track pipeline value, and monitor key stakeholders.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search accounts..." 
            className="pl-10 pr-4 py-2 bg-white/50 backdrop-blur-sm border border-white/20 shadow-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-300 w-64 focus:w-80"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-indigo-100 rounded-xl">
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Accounts</p>
              <h2 className="text-3xl font-bold text-gray-900">{accounts?.length || 0}</h2>
            </div>
          </div>
        </div>
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-purple-100 rounded-xl">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Pipeline Value</p>
              <h2 className="text-3xl font-bold text-gray-900">
                ${accounts?.reduce((sum: number, acc: any) => sum + (acc.Deals?.reduce((ds: number, d: any) => ds + parseFloat(d.amount || 0), 0) || 0), 0).toLocaleString()}
              </h2>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-2xl rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200/50">
          <thead className="bg-gray-50/50 backdrop-blur-md">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacts</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Deals</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline Value</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/50 bg-transparent">
            {accounts?.map((account: any) => (
              <tr key={account.id} className="hover:bg-white/60 transition-colors duration-200 group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-white shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <span className="text-indigo-700 font-bold text-lg">{account.name.charAt(0)}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{account.name}</div>
                      <div className="text-xs text-gray-500">Created {new Date(account.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex -space-x-2 overflow-hidden">
                    {account.contacts?.slice(0, 3).map((contact: any, i: number) => (
                      <div key={contact.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-indigo-50 flex flex-col items-center justify-center text-xs font-medium text-indigo-700" title={contact.firstName + " " + contact.lastName}>
                        {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}
                      </div>
                    ))}
                    {account.contacts?.length > 3 && (
                      <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex flex-col items-center justify-center text-xs font-medium text-gray-600">
                        +{account.contacts.length - 3}
                      </div>
                    )}
                  </div>
                  {(!account.contacts || account.contacts.length === 0) && (
                    <span className="text-sm text-gray-400 italic">No contacts</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 shadow-sm border border-purple-200">
                    {account.Deals?.length || 0} Deals
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${account.Deals?.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center inline-flex space-x-1">
                    <span>View</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {accounts?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No accounts found. Create your first account to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
