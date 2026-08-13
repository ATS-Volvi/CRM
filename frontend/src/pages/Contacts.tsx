import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { Users, Mail, Phone, Building, Search, ArrowUpRight } from "lucide-react";

export default function Contacts() {
  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/contacts");
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
    return <div className="text-red-500 p-6">Error loading contacts</div>;
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
            Contacts
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Manage your global directory of stakeholders, decision makers, and leads.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="pl-10 pr-4 py-2 bg-white/50 backdrop-blur-sm border border-white/20 shadow-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-300 w-64 focus:w-80"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-emerald-100 rounded-xl">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Contacts</p>
              <h2 className="text-3xl font-bold text-gray-900">{contacts?.length || 0}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-2xl rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200/50">
          <thead className="bg-gray-50/50 backdrop-blur-md">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Deals</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/50 bg-transparent">
            {contacts?.map((contact: any) => (
              <tr key={contact.id} className="hover:bg-white/60 transition-colors duration-200 group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 border border-white shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <span className="text-emerald-700 font-bold text-lg">
                        {contact.firstName?.charAt(0) || "?"}{contact.lastName?.charAt(0) || ""}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-xs text-gray-500">Source: {contact.sourceChannel || 'Unknown'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Building className="w-4 h-4 text-gray-400 mr-2" />
                    {contact.account?.name || <span className="text-gray-400 italic">Unassigned</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center text-xs text-gray-600">
                      <Mail className="w-3 h-3 text-gray-400 mr-2" />
                      {contact.email || '-'}
                    </div>
                    <div className="flex items-center text-xs text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400 mr-2" />
                      {contact.phone || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    {contact.deals?.length > 0 ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-teal-100 text-teal-800 shadow-sm border border-teal-200">
                        {contact.deals.length} Deals
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No deals</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center inline-flex space-x-1">
                    <span>View</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {contacts?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
