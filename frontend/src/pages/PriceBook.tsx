import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload, Download, Edit, MoreVertical, Plus, ChevronLeft, ChevronRight, Gavel, History, Cloud, ShieldCheck, Cpu, Settings } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function PriceBook() {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState("All Products");
  
  const tabs = [
    "All Products",
    "Standard Tier",
    "Enterprise / VIP",
    "Regional (GCC)",
    "Distributor Book"
  ];
  const { data: priceBook, isLoading } = useQuery({
    queryKey: ["priceBook"],
    queryFn: async () => {
      const url = activeTab === "All Products" ? "/api/v1/price-book" : `/api/v1/price-book?category=${activeTab}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch price book");
      return res.json();
    }
  });

  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", sku: "", category: "Standard Tier", msrp: "", floor_price: "", uplift: "0", status: "Active", promoStart: "", promoEnd: "", segStandard: "", segEnterprise: "", segGCC: "", segDistributor: "" });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/price-book/${data.id}` : "/api/v1/price-book", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          ...data,
          listPrice: data.msrp, 
          itemCode: data.sku
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priceBook"] });
      setShowModal(false);
      setFormData({ name: "", sku: "", category: "Standard Tier", msrp: "", floor_price: "", uplift: "0", status: "Active", promoStart: "", promoEnd: "", segStandard: "", segEnterprise: "", segGCC: "", segDistributor: "" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/price-book/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["priceBook"] })
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        {/* Page Header & Action Bar */}
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-4xl font-bold text-on-surface">Price Book</h2>
            <p className="text-base text-on-surface-variant">Manage global product pricing, discounts, and regional adjustments.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 border border-secondary text-secondary rounded-lg hover:bg-secondary-container transition-colors">
              <Upload className="w-5 h-5" />
              <span className="font-bold">Bulk Update</span>
            </button>
            <button onClick={() => alert("Export functionality not yet implemented.")} className="flex items-center gap-2 px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors">
              <Download className="w-5 h-5" />
              <span className="font-bold">Export .XLSX</span>
            </button>
          </div>
        </div>

        {/* Bento Grid Stats & Promotions */}
        <div className="grid grid-cols-12 gap-6">
          {/* Promo Schedule Card */}
          <div className="col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[12px] font-bold text-primary uppercase tracking-widest">Active Promotion</span>
                <h3 className="text-lg font-semibold mt-1">Q4 Middle East Expansion Sale</h3>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[12px] font-bold">LIVE</div>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-on-surface-variant">Progress</span>
                  <span className="font-bold">64% Complete</span>
                </div>
                <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "64%" }}></div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] text-on-surface-variant uppercase">End Date</span>
                <span className="text-base font-bold">DEC 31, 2024</span>
              </div>
            </div>
            {/* Background Visual Element */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* Stats Summary */}
          <div className="col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <span className="text-[12px] text-on-surface-variant font-bold uppercase tracking-wider">Inventory Health</span>
            <div className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">In Price Book</span>
                <span className="text-base font-bold">1,284 SKUs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Below Margin Floor</span>
                <span className="text-base font-bold text-error">12 Products</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Awaiting Approval</span>
                <span className="text-base font-bold text-secondary">48 Updates</span>
              </div>
            </div>
          </div>
        </div>

        {/* Segment Tabs */}
        <div className="flex border-b border-outline-variant gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-bold text-[12px] uppercase whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Data Table Section */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0 border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">SKU / Product Name</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Min Price</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Max Price</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">GCC Uplift</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading price book...</td>
                  </tr>
                ) : (
                  priceBook?.map((item: any, i: number) => (
                    <tr key={item.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-surface-container flex items-center justify-center rounded">
                            {i % 4 === 0 ? <Cloud className="w-5 h-5 text-outline" /> :
                             i % 4 === 1 ? <ShieldCheck className="w-5 h-5 text-outline" /> :
                             i % 4 === 2 ? <Cpu className="w-5 h-5 text-outline" /> :
                             <Settings className="w-5 h-5 text-outline" />}
                          </div>
                          <div>
                            <span className="font-bold block">{item.name}</span>
                            <span className="text-xs text-on-surface-variant opacity-70">SKU: {item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">{item.category}</td>
                      <td className="px-6 py-5 font-medium text-error font-bold">{formatCurrency(item.floor_price || 0)}</td>
                      <td className="px-6 py-5 font-medium">{formatCurrency(item.msrp || 0)}</td>
                      <td className="px-6 py-5">
                        <span className="text-primary font-bold">+{item.uplift}%</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">{item.status}</span>
                      </td>
                      <td className="px-6 py-5 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setFormData(item);
                            setShowModal(true);
                          }}
                          className="p-2 hover:bg-surface-container-lowest rounded-full transition-colors text-outline"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            if(confirm("Are you sure you want to delete this item?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="p-2 hover:bg-error-container rounded-full transition-colors text-error"
                        >
                          <span className="font-bold">X</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-outline-variant bg-surface-container-low">
            <span className="text-sm text-on-surface-variant">Showing 1-10 of 1,284 results</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="px-3 py-1 bg-primary text-on-primary rounded font-bold">1</button>
              <button className="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-on-surface-variant">2</button>
              <button className="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-on-surface-variant">3</button>
              <button className="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Utilities Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Price Rules Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="w-6 h-6 text-secondary" />
              <h4 className="text-lg font-semibold">Global Pricing Rules</h4>
            </div>
            <ul className="space-y-3">
              <li className="flex justify-between items-center p-3 bg-surface-container rounded-lg">
                <span className="text-sm">Minimum Margin Threshold</span>
                <span className="text-sm font-bold">22.5%</span>
              </li>
              <li className="flex justify-between items-center p-3 bg-surface-container rounded-lg">
                <span className="text-sm">Bulk Discount Cap</span>
                <span className="text-sm font-bold">15% Max</span>
              </li>
            </ul>
          </div>
          
          {/* Last Import Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-6 h-6 text-primary" />
              <h4 className="text-lg font-semibold">Last Master Sync</h4>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-on-surface-variant">System-wide update completed today at 04:30 AM (GST)</p>
                <p className="text-xs text-on-surface-variant opacity-60 mt-1">Managed by: Global-Sys-Admin</p>
              </div>
              <button className="text-secondary font-bold text-[12px] uppercase tracking-wider hover:underline">RETRY SYNC</button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => {
          setFormData({ name: "", sku: "", category: "Standard Tier", msrp: "", floor_price: "", uplift: "0", status: "Active", promoStart: "", promoEnd: "", segStandard: "", segEnterprise: "", segGCC: "", segDistributor: "" });
          setShowModal(true);
        }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[400px] max-w-full shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="font-bold">X</span>
            </button>
            <h3 className="text-xl font-bold mb-4">{formData.id ? "Edit Item" : "Add New Item"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Product Name</label>
                <input type="text" className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">SKU</label>
                <input type="text" className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Category</label>
                <select className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option>Standard Tier</option>
                  <option>Enterprise / VIP</option>
                  <option>Regional (GCC)</option>
                  <option>Distributor Book</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Max Price (MSRP) ($)</label>
                  <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm" value={formData.msrp} onChange={e => setFormData({...formData, msrp: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Min Price (Floor) ($)</label>
                  <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm" value={formData.floor_price} onChange={e => setFormData({...formData, floor_price: e.target.value})} />
                </div>
              </div>
              
              <div className="border-t border-outline-variant pt-4">
                <h4 className="text-sm font-bold mb-3 text-primary uppercase tracking-wider">Segment Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Standard</label>
                    <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.segStandard || formData.msrp} onChange={e => setFormData({...formData, segStandard: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Enterprise</label>
                    <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.segEnterprise} onChange={e => setFormData({...formData, segEnterprise: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">GCC Regional</label>
                    <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.segGCC} onChange={e => setFormData({...formData, segGCC: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Distributor</label>
                    <input type="number" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.segDistributor} onChange={e => setFormData({...formData, segDistributor: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border-t border-outline-variant pt-4">
                <h4 className="text-sm font-bold mb-3 text-secondary uppercase tracking-wider">Promotional Dates</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Promo Start</label>
                    <input type="date" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.promoStart} onChange={e => setFormData({...formData, promoStart: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Promo End</label>
                    <input type="date" className="w-full bg-surface-container border border-outline-variant rounded p-1.5 text-sm" value={formData.promoEnd} onChange={e => setFormData({...formData, promoEnd: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold">Cancel</button>
                <button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded text-sm font-bold">
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-xl w-[500px] max-w-full shadow-2xl relative">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="font-bold">X</span>
            </button>
            <h3 className="text-xl font-bold mb-2">Bulk Update Price Book</h3>
            <p className="text-sm text-on-surface-variant mb-6">Upload an Excel (.xlsx) or CSV file with the updated pricing. Ensure the format matches the master template.</p>
            
            <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 flex flex-col items-center justify-center bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer mb-6">
              <Upload className="w-10 h-10 text-primary mb-3" />
              <p className="font-bold text-on-surface">Click to upload or drag and drop</p>
              <p className="text-xs text-on-surface-variant mt-1">.XLSX, .CSV (Max 10MB)</p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm font-bold">Cancel</button>
              <button onClick={() => { alert("Simulated Excel upload"); setShowUploadModal(false); }} className="px-4 py-2 bg-primary text-white rounded text-sm font-bold">
                Process File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
