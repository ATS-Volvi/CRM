import { FileText, Download, MoreVertical, Plus } from "lucide-react";

export default function PurchaseOrders() {
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Purchase Orders</h1>
          <p className="text-on-surface-variant">Manage and track POs from clients</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold hover:opacity-90">
          <Plus className="w-5 h-5" /> New PO
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
          <h2 className="text-lg font-semibold">Recent Purchase Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">PO Number</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Client</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Amount</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              <tr className="hover:bg-surface-container transition-colors">
                <td className="px-6 py-4 font-bold text-primary">PO-2023-001</td>
                <td className="px-6 py-4">Acme Corp</td>
                <td className="px-6 py-4 font-medium">$45,000.00</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Verified</span>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button className="p-2 text-on-surface-variant hover:text-primary"><Download className="w-4 h-4" /></button>
                  <button className="p-2 text-on-surface-variant hover:text-primary"><MoreVertical className="w-4 h-4" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
