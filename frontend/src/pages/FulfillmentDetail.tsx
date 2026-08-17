import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fulfillmentsApi, queryKeys } from "../api";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  Building,
  Package,
  Calendar,
  AlertCircle,
  FileCheck,
  ShieldCheck
} from "lucide-react";

const STAGES = [
  "PENDING",
  "PLANNING",
  "PROCUREMENT",
  "IN_PRODUCTION",
  "READY",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED"
];

export default function FulfillmentDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [dispatchRef, setDispatchRef] = useState("");
  const [carrier, setCarrier] = useState("DHL Logistics");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState("");

  const { data: fulfillment, isLoading, error } = useQuery({
    queryKey: queryKeys.fulfillments.detail(id || ""),
    queryFn: () => fulfillmentsApi.getFulfillmentById(id || ""),
    enabled: Boolean(id)
  });

  const statusMutation = useMutation({
    mutationFn: ({ nextStatus, updates }: { nextStatus: string; updates?: any }) =>
      fulfillmentsApi.updateFulfillmentStatus(id || "", nextStatus, updates),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.all });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error || err.message || "Failed to update fulfillment status");
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading fulfillment details...</div>;
  }

  if (error || !fulfillment) {
    return <div className="p-8 text-center text-rose-500">Error: {(error as any)?.message || "Fulfillment not found"}</div>;
  }

  const order = (fulfillment as any).order;
  const quote = order?.quote;
  const deal = quote?.deal;
  const account = deal?.account || deal?.customer;
  const items = (fulfillment as any).items || [];
  const currentStatusIndex = STAGES.indexOf(fulfillment.status);

  const handleAdvanceStage = (nextStatus: string) => {
    setActionError("");
    if (nextStatus === "DISPATCHED" && !dispatchRef && !(fulfillment as any).dispatchReference) {
      setActionError("Dispatch tracking number / reference is required for DISPATCHED stage.");
      return;
    }

    const updates: any = {};
    if (dispatchRef) updates.dispatchReference = dispatchRef;
    if (carrier) updates.carrier = carrier;
    if (notes) updates.notes = notes;

    statusMutation.mutate({ nextStatus, updates });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/supply/queue"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-indigo-400" />
              Fulfillment for Order {order?.poNumber || (fulfillment as any).orderId}
            </h1>
            <p className="text-sm text-slate-400">
              Customer: <span className="text-white font-medium">{account?.name || "Client Account"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/orders/${(fulfillment as any).orderId}`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
          >
            View Commercial Order
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Operational Stage Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Supply Lifecycle Stepper
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStatusIndex;
            const isCurrent = idx === currentStatusIndex;
            return (
              <div
                key={stage}
                className={`p-3 rounded-lg border text-center transition ${
                  isCurrent
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold"
                    : isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-800/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="text-xs font-medium">{stage}</div>
                {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mt-1" />}
                {isCurrent && <Clock className="w-4 h-4 text-indigo-400 mx-auto mt-1 animate-pulse" />}
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {fulfillment.status === "PENDING" && (
              <button
                onClick={() => handleAdvanceStage("PLANNING")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Advance to PLANNING
              </button>
            )}
            {fulfillment.status === "PLANNING" && (
              <button
                onClick={() => handleAdvanceStage("PROCUREMENT")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Advance to PROCUREMENT
              </button>
            )}
            {fulfillment.status === "PROCUREMENT" && (
              <button
                onClick={() => handleAdvanceStage("IN_PRODUCTION")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Advance to IN_PRODUCTION
              </button>
            )}
            {fulfillment.status === "IN_PRODUCTION" && (
              <button
                onClick={() => handleAdvanceStage("READY")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Advance to READY (QA Passed)
              </button>
            )}
            {fulfillment.status === "READY" && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Carrier tracking / dispatch ref..."
                  value={dispatchRef}
                  onChange={(e) => setDispatchRef(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleAdvanceStage("DISPATCHED")}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Confirm DISPATCH
                </button>
              </div>
            )}
            {fulfillment.status === "DISPATCHED" && (
              <button
                onClick={() => handleAdvanceStage("DELIVERED")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
              >
                Confirm Site DELIVERY & Generate Assets
              </button>
            )}
            {fulfillment.status === "DELIVERED" && (
              <button
                onClick={() => handleAdvanceStage("COMPLETED")}
                disabled={statusMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
              >
                Complete Fulfillment
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400">
            Current Status: <span className="font-semibold text-white">{fulfillment.status}</span>
          </div>
        </div>
      </div>

      {/* Fulfillment Items Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-400" />
          Fulfillment Items & Quantities
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-medium">
              <tr>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4">Planned Qty</th>
                <th className="py-3 px-4">Allocated</th>
                <th className="py-3 px-4">In Production</th>
                <th className="py-3 px-4">Delivered</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4 font-medium text-white">
                    {item.description || item.product?.name || "Equipment Deliverable"}
                  </td>
                  <td className="py-3.5 px-4">{item.quantityPlanned}</td>
                  <td className="py-3.5 px-4">{item.quantityAllocated}</td>
                  <td className="py-3.5 px-4">{item.quantityInProduction}</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400">{item.quantityDelivered}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                      {item.status || "PENDING"}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No fulfillment items recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
