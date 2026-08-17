import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fulfillmentsApi, queryKeys } from "../api";
import { Truck, Search, Filter, Clock, CheckCircle, ArrowRight, ShieldAlert } from "lucide-react";

export default function SupplyQueue() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.fulfillments.list({ status: statusFilter, search }),
    queryFn: () => fulfillmentsApi.getFulfillments({ status: statusFilter || undefined, search: search || undefined })
  });

  const fulfillments = data?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" />
            Supply & Fulfillment Queue
          </h1>
          <p className="text-sm text-slate-400">
            Operations workspace for order production, dispatch, and delivery tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/assets"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
          >
            Customer Assets
          </Link>
          <Link
            to="/purchase-orders"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            Confirmed Orders
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Order # or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Fulfillment Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PLANNING">PLANNING</option>
            <option value="PROCUREMENT">PROCUREMENT</option>
            <option value="IN_PRODUCTION">IN_PRODUCTION</option>
            <option value="READY">READY</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ON_HOLD">ON_HOLD</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading supply queue...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500">Error loading queue: {(error as any)?.message}</div>
        ) : fulfillments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No fulfillment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer / Account</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Supply Status</th>
                  <th className="py-3 px-4">Delivery Date</th>
                  <th className="py-3 px-4">Assigned Team</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fulfillments.map((f: any) => {
                  const account = f.order?.quote?.deal?.account || f.order?.quote?.deal?.customer;
                  return (
                    <tr key={f.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {f.order?.poNumber || f.orderId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{account?.name || "N/A"}</div>
                        <div className="text-xs text-slate-400">{account?.industry || "Industrial"}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            f.priority === "URGENT"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : f.priority === "HIGH"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {f.priority || "MEDIUM"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            f.status === "COMPLETED" || f.status === "DELIVERED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : f.status === "DISPATCHED"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : f.status === "IN_PRODUCTION"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {f.actualDeliveryDate
                          ? new Date(f.actualDeliveryDate).toLocaleDateString()
                          : f.requestedDeliveryDate
                          ? new Date(f.requestedDeliveryDate).toLocaleDateString()
                          : "Not scheduled"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {f.assignedUser?.name || f.assignedTeam || "Operations"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/fulfillments/${f.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Manage <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
