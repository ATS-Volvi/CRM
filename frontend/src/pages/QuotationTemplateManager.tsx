import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Sparkles, CheckCircle2, Layout, Sliders, FileText, Check, Palette } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function QuotationTemplateManager() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);

  const { data: templates } = useQuery({
    queryKey: ["quoteTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/v1/quote-templates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (tplData: any) => {
      const res = await fetch("/api/v1/quote-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(tplData)
      });
      if (!res.ok) throw new Error("Failed to save template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quoteTemplates"] });
      alert("Quotation Template saved successfully!");
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const res = await fetch("/api/v1/quote-templates/parse-reference", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (data?.template) {
        setActiveTemplate(data.template);
      }
    } catch (err) {
      console.error("AI Vision extraction error:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const current = activeTemplate || (templates && templates[0]) || {
    name: "FTC Saudi Arabia Standard",
    companyName: "Faisal Fahad Hussain Al Kari Transportation Co.",
    companyAddress: "Prince Fahad St, Al Khobar, Kingdom of Saudi Arabia",
    primaryColor: "#6b21a8",
    headerBgColor: "#fbf5ff",
    introLetterText: "Thank you for showing your interest in us & inviting us to Quote...",
    currency: "SAR",
    taxRate: 0.15,
    tableColumns: [
      { key: "slNo", label: "Sl No.", width: "10%" },
      { key: "description", label: "Item Description", width: "50%" },
      { key: "uom", label: "UOM", width: "12%" },
      { key: "qty", label: "Qty", width: "10%" },
      { key: "price", label: "Price (SAR)", width: "18%" }
    ]
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">AI Quotation Template Engine</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
              White-Label Vision Parser
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Upload reference quotation PDFs/images from any company to automatically extract layout, colors, column formats, and branding rules.
          </p>
        </div>

        <button
          onClick={() => createTemplateMutation.mutate(current)}
          className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-all flex items-center gap-1.5"
        >
          <Check className="w-4 h-4 text-emerald-400" /> Save Template Schema
        </button>
      </div>

      {/* Grid Layout: Left Uploader & Customizer / Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT 5 COLUMNS: AI VISION UPLOADER & CUSTOMIZER */}
        <div className="lg:col-span-5 space-y-6">

          {/* AI Vision Reference Document Uploader Box */}
          <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-purple-200 dark:border-purple-900/60 rounded-2xl p-6 shadow-xs text-center space-y-4 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mx-auto">
              {isParsing ? <Sparkles className="w-6 h-6 animate-spin text-purple-600" /> : <Upload className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {isParsing ? "AI Vision Analyzing Reference PDF..." : "Upload Reference Quotation PDF / Image"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Drag and drop a sample PDF or screenshot from any company to extract layout rules automatically.
              </p>
            </div>

            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />

            {selectedFile && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reference: {selectedFile.name}</span>
              </div>
            )}
          </div>

          {/* Saved Company Templates List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Company Layout Templates</h4>
            <div className="space-y-2">
              {(templates || [current]).map((t: any) => (
                <div
                  key={t.id || t.name}
                  onClick={() => setActiveTemplate(t)}
                  className={`p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-between ${
                    (activeTemplate?.name || current.name) === t.name
                      ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layout className="w-4 h-4 text-purple-600" />
                    <span>{t.name}</span>
                  </div>
                  {t.isDefault && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-900 text-white rounded">Default</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Schema Customizer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-xs font-medium">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-600" /> Dynamic Branding Rules
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Company Name</label>
                <input
                  type="text"
                  value={current.companyName}
                  onChange={(e) => setActiveTemplate({ ...current, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Primary Theme Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={current.primaryColor}
                    onChange={(e) => setActiveTemplate({ ...current, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{current.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Intro Letter Salutation</label>
                <textarea
                  rows={3}
                  value={current.introLetterText}
                  onChange={(e) => setActiveTemplate({ ...current, introLetterText: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT 7 COLUMNS: DYNAMIC PDF / HTML LIVE PREVIEW */}
        <div className="lg:col-span-7 bg-slate-100 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[600px] flex flex-col items-center">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-4 block">
            🖼️ Live Rendering PDF Document Preview
          </span>

          {/* Simulated White PDF Sheet */}
          <div className="w-full max-w-[550px] bg-white text-slate-900 shadow-2xl rounded-lg p-6 space-y-6 font-sans text-xs border border-slate-200">
            
            {/* Dynamic Header Box */}
            <div className="grid grid-cols-3 gap-2 text-center rounded-lg p-3" style={{ backgroundColor: current.headerBgColor || "#fbf5ff" }}>
              <div className="border-r border-slate-200/80 pr-2">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">DATE</span>
                <span className="font-bold">10/08/2026</span>
              </div>
              <div className="border-r border-slate-200/80 pr-2">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">QUOTATION NO.</span>
                <span className="font-extrabold" style={{ color: current.primaryColor }}>FTC-2026-991</span>
              </div>
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">REVISION</span>
                <span className="font-bold">0</span>
              </div>
            </div>

            {/* Company & Client Boxes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-lime-50/50 p-3 rounded-lg border border-lime-100 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Company Name</span>
                <p className="font-extrabold text-slate-900">{current.companyName}</p>
                <p className="text-[10px] text-slate-500">{current.companyAddress}</p>
              </div>
              <div className="bg-sky-50/50 p-3 rounded-lg border border-sky-100 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Client / Destination</span>
                <p className="font-extrabold text-slate-900">Valued Client, Riyadh / Abqaiq</p>
              </div>
            </div>

            {/* Intro Letter */}
            {current.introLetterEnabled && (
              <div className="space-y-2">
                <p className="font-extrabold text-slate-900">Dear Client,</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{current.introLetterText}</p>
              </div>
            )}

            {/* Dynamic Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead style={{ backgroundColor: current.headerBgColor || "#fbf5ff" }}>
                  <tr className="border-b border-slate-200 font-bold text-slate-700">
                    {current.tableColumns?.map((col: any) => (
                      <th key={col.key} className="p-2.5">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2.5 font-bold">01</td>
                    <td className="p-2.5">Porta Cabin Office Unit (12m x 3.5m) with Air Conditioning</td>
                    <td className="p-2.5 text-center">Unit</td>
                    <td className="p-2.5 text-center">02</td>
                    <td className="p-2.5 text-right font-bold">SAR 45,000.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-2">
              <div className="w-48 bg-slate-50 p-3 rounded-lg space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-bold">SAR 45,000.00</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT ({((current.taxRate || 0.15) * 100).toFixed(0)}%):</span>
                  <span className="font-bold">SAR 6,750.00</span>
                </div>
                <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                  <span>Grand Total ({current.currency}):</span>
                  <span>SAR 51,750.00</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between items-end pt-8 border-t border-slate-100 text-[10px]">
              <div>
                <p className="font-bold text-slate-800">{current.companyName}</p>
                <p className="text-slate-400">{current.companyAddress}</p>
              </div>
              <div className="text-center border-t border-slate-400 pt-1 w-36">
                <span className="font-bold text-slate-600">Authorized Signature</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
