import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  X, Phone, Mail, MessageSquare, Tag, Calendar, User, DollarSign, 
  Send, Clock, CheckCircle2, Sparkles, AlertCircle, Play
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

export interface DrawerRecord {
  id: string;
  type: "lead" | "customer" | "deal" | "quote" | "task";
  title: string;
  subtitle?: string;
  status?: string;
  value?: number;
  assignedTo?: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  score?: number;
  tags?: string[];
  raw?: any;
}

interface SplitViewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: DrawerRecord | null;
}

export function SplitViewDrawer({ isOpen, onClose, record }: SplitViewDrawerProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "sequences">("overview");
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [telephonyConfigured, setTelephonyConfigured] = useState<boolean | null>(null);
  const [sequences, setSequences] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && token) {
      // Check telephony configuration status
      fetch("/api/v1/telephony/status", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setTelephonyConfigured(data.configured))
        .catch(() => setTelephonyConfigured(false));

      // Fetch drip sequences
      fetch("/api/v1/sequences", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setSequences(Array.isArray(data) ? data : []))
        .catch(() => setSequences([]));

      if (record?.id) {
        fetch(`/api/v1/sequences/enrollments?leadId=${record.id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => setEnrollments(Array.isArray(data) ? data : []))
          .catch(() => setEnrollments([]));
      }
    }
  }, [isOpen, record?.id, token]);

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

  const handleEnrollSequence = async (sequenceId: string) => {
    try {
      const res = await fetch("/api/v1/sequences/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ leadId: record.id, sequenceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      alert("Enrolled in drip sequence successfully!");
      // refresh enrollments
      fetch(`/api/v1/sequences/enrollments?leadId=${record.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      }).then(r => r.json()).then(d => setEnrollments(Array.isArray(d) ? d : []));
    } catch (err: any) {
      alert("Failed to enroll: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-2xl animate-slide-left">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-extrabold uppercase">
              {record.type}
            </span>
            <div>
              <h3 className="text-sm font-black text-foreground">{record.title}</h3>
              {record.subtitle && <p className="text-[11px] text-muted-foreground font-semibold">{record.subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar with Telephony Status Indicator */}
        <div className="p-3 border-b border-border bg-muted/10 space-y-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleInitiateCall}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                telephonyConfigured 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "bg-muted text-muted-foreground border border-border cursor-not-allowed"
              }`}
              title={telephonyConfigured ? "Click to Call via Twilio" : "Telephony not configured in .env"}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{telephonyConfigured ? "Twilio Call" : "Call (Not Configured)"}</span>
            </button>

            <button 
              onClick={() => setActiveTab("sequences")}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all"
            >
              <Play className="w-3.5 h-3.5" /> Drip Sequences ({enrollments.length})
            </button>
          </div>

          {callStatus && (
            <p className="text-[11px] font-bold text-primary text-center bg-primary/10 p-1 rounded border border-primary/20">
              {callStatus}
            </p>
          )}
        </div>

        {/* Tabs Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Expected Value</span>
                  <p className="text-base font-black text-emerald-600">{formatCurrency(record.value || 0)}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Status</span>
                  <p className="text-sm font-bold text-foreground">{record.status || "Active"}</p>
                </div>
              </div>

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

          {activeTab === "sequences" && (
            <div className="space-y-4 text-xs">
              <h4 className="font-bold text-foreground">Marketing Automation & Drip Sequences</h4>
              
              {/* Active Enrollments */}
              {enrollments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Enrolled Sequences</span>
                  {enrollments.map((en: any) => (
                    <div key={en.id} className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-primary">{en.sequence?.name || "Drip Sequence"}</p>
                        <p className="text-[10px] text-muted-foreground">Step {en.currentStep} | Status: {en.status}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded">Active</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Enroll Button Dropdown */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Enroll In New Sequence</span>
                {sequences.map((seq: any) => (
                  <div key={seq.id} className="p-3 bg-muted/40 border border-border rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-foreground">{seq.name}</p>
                      <p className="text-[10px] text-muted-foreground">Trigger: {seq.triggerEvent || "Manual"}</p>
                    </div>
                    <button 
                      onClick={() => handleEnrollSequence(seq.id)}
                      className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-2xs"
                    >
                      Enroll
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
