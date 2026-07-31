import { useState, useEffect } from "react";
import { X, Phone, Play, ChevronRight, User, Mail, Calendar, DollarSign } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";

interface SplitViewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
}

export function SplitViewDrawer({ isOpen, onClose, record }: SplitViewDrawerProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [telephonyConfigured, setTelephonyConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      // Check telephony configuration status
      fetch("/api/v1/telephony/status", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setTelephonyConfigured(data.configured))
        .catch(() => setTelephonyConfigured(false));
    }
  }, [isOpen, token]);

  if (!isOpen || !record) return null;

  const handleInitiateCall = async () => {
    if (!telephonyConfigured) {
      alert("Telephony not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.");
      return;
    }

    setCallStatus("Initiating call via Twilio...");
    try {
      const res = await fetch("/api/v1/telephony/call", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: record.id,
          phoneNumber: record.phone || "+12025550123"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setCallStatus(`Call Connected (${data.callSid})`);
    } catch (err: any) {
      setCallStatus(`Call Failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-2xl animate-slide-left">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Split-View Drawer</span>
            <h3 className="text-base font-extrabold text-foreground truncate max-w-[340px]">
              {record.name || record.subject || `${record.firstName} ${record.lastName}`}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 border-b border-border bg-card space-y-2">
          <div className="flex gap-2">
            <button 
              onClick={handleInitiateCall}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{telephonyConfigured ? "Twilio Call" : "Call (Not Configured)"}</span>
            </button>
          </div>

          {callStatus && (
            <p className="text-[11px] font-bold text-primary text-center bg-primary/10 p-1 rounded border border-primary/20">
              {callStatus}
            </p>
          )}
        </div>

        {/* Tabs Body */}
        <div className="flex border-b border-border text-xs font-bold bg-muted/20">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
              activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview & Details
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Value KPI Card */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Estimated Deal Value</span>
                  <span className="text-xl font-black text-foreground">{formatCurrency(record.value || record.amount || 100000)}</span>
                </div>
                <div className="p-2 bg-primary/10 rounded-xl text-primary font-bold text-xs">
                  {record.status || "New"}
                </div>
              </div>

              {/* Details List */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                <h4 className="font-bold text-foreground">Contact & Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[10px] text-muted-foreground block font-bold">Email</span><span>{record.email || "N/A"}</span></div>
                  <div><span className="text-[10px] text-muted-foreground block font-bold">Phone</span><span>{record.phone || "N/A"}</span></div>
                  <div><span className="text-[10px] text-muted-foreground block font-bold">Company</span><span>{record.company || "N/A"}</span></div>
                  <div><span className="text-[10px] text-muted-foreground block font-bold">Industry</span><span>{record.industry || "General"}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
