import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ordersApi, fulfillmentsApi, queryKeys } from "../api";
import { ArrowLeft, Package, Clock, Building, DollarSign, FileText, CheckCircle, ShieldCheck } from "lucide-react";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.detail(id || ""),
    queryFn: () => ordersApi.getOrderById(id || ""),
    enabled: Boolean(id)
  });

  const { data: fulfillment } = useQuery({
    queryKey: queryKeys.fulfillments.byOrder(id || ""),
    queryFn: () => fulfillmentsApi.getFulfillmentByOrderId(id || ""),
    enabled: Boolean(id)
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center text-rose-500">
        Error loading order: {(error as any)?.message || "Order not found"}
      </div>
    );
  }

  const quote = (order as any)?.quote;
  const deal = quote?.deal;
  const account = deal?.account || (deal as any)?.customer;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/purchase-orders"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-400" />
              Order {order.poNumber || order.orderNumber || order.id}
            </h1>
            <p className="text-sm text-slate-400">
              Confirmed on {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              order.status === "Completed"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : order.status === "Delivered"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}
          >
            {order.status}
          </span>
          {fulfillment && (
            <Link
              to={`/fulfillments/${fulfillment.id}`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
            >
              Manage Supply & Fulfillment
            </Link>
          )}
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-medium text-slate-400">Account & Customer</h2>
          </div>
          <p className="text-lg font-bold text-white">{account?.name || "N/A"}</p>
          <p className="text-xs text-slate-400 mt-1">{account?.email || account?.industry || "Enterprise Client"}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-medium text-slate-400">Commercial Amount</h2>
          </div>
          <p className="text-lg font-bold text-white">
            ₹{Number(order.amount || order.grandTotal || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">Source Quote: {quote?.quoteNumber || quote?.id || "N/A"} v{quote?.version || 1}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-medium text-slate-400">Fulfillment Status</h2>
          </div>
          <p className="text-lg font-bold text-white">{fulfillment?.status || "PENDING"}</p>
          <p className="text-xs text-slate-400 mt-1">
            Team: {fulfillment?.assignedTeam || "Operations / Supply"}
          </p>
        </div>
      </div>

      {/* Agreed Quote Line Items Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          Agreed Commercial Line Items
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-medium">
              <tr>
                <th className="py-3 px-4">Item / Product</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(quote?.QuoteLineItems || []).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-medium text-white">
                    {item.customDescription || item.product?.name || "Commercial Deliverable"}
                  </td>
                  <td className="py-3 px-4">{Number(item.quantity)}</td>
                  <td className="py-3 px-4">₹{Number(item.unitPrice).toLocaleString()}</td>
                  <td className="py-3 px-4 font-semibold text-emerald-400">
                    ₹{Number(item.totalPrice || item.quantity * item.unitPrice).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!quote?.QuoteLineItems || quote.QuoteLineItems.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    No line items available
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
