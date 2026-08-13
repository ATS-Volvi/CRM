import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Unlock, X, Phone, Mail, Building, Plus, FileText, CheckCircle2, Clock, Star, AlertCircle, Link, Users } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { RelatedInquiriesModal } from "./RelatedInquiriesModal";

function ContactCard({ contact }: { contact: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="p-3 bg-muted/20 border border-border rounded-lg text-xs flex flex-col gap-1">
      <div className="flex justify-between items-start">
        <span className="font-bold text-foreground">{contact.firstName} {contact.lastName}</span>
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">{contact.role || "Contact"}</span>
      </div>
      {contact.email && <div className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> {contact.email}</div>}
      {contact.phone && <div className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" /> {contact.phone}</div>}
      
      {contact.message && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="text-[10px] uppercase font-bold text-foreground mb-1">Message / Request</div>
          <div className={`text-muted-foreground ${!isExpanded && contact.message.length > 100 ? "line-clamp-2" : ""}`}>
            {contact.message}
          </div>
          {contact.message.length > 100 && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-primary hover:underline text-[10px] font-bold"
            >
              {isExpanded ? "Show Less" : "Show More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SplitViewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
}

export function SplitViewDrawer({ isOpen, onClose, record }: SplitViewDrawerProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showInquiriesModal, setShowInquiriesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [telephonyConfigured, setTelephonyConfigured] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  useEffect(() => {
    if (isOpen && record && token) {
      setIsLoadingContacts(true);
      fetch(`/api/v1/leads/${record.id}/contacts`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setContacts(data);
          else setContacts([]);
        })
        .catch(() => setContacts([]))
        .finally(() => setIsLoadingContacts(false));
    }
  }, [isOpen, record, token]);

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

  const updateTempMutation = useMutation({
    mutationFn: async (temperature: string) => {
      const res = await fetch(`/api/v1/leads/${record.id}/temperature`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ temperature })
      });
      if (!res.ok) throw new Error("Failed to update temperature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }
  });

  const unlockTempMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${record.id}/temperature/unlock`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to unlock temperature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }
  });

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

              {/* Compact Intake Automation Card */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                  <h4 className="font-bold text-primary flex items-center gap-1.5">⚡ Intake Automation</h4>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 uppercase">Active</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-foreground">
                    <span className="font-medium text-emerald-600">✓ Lead Received</span>
                    <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">{record.source || "Website"}</span>
                  </div>
                  <div className="flex justify-between items-center text-foreground">
                    <span className="font-medium text-emerald-600">✓ Owner Assigned</span>
                    <span className="font-bold">{record.assignedTo?.name || "Unassigned"}</span>
                  </div>
                  <div className="flex justify-between items-center text-foreground">
                    <span className="font-medium text-emerald-600">✓ First Response</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {record.source === "Cold Call" || record.source === "Manual Entry" ? "Task Generated" : "Sent"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-foreground">
                    <span className="font-medium text-emerald-600">✓ Follow-up Task</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Active SLA</span>
                  </div>
                </div>
              </div>

              {/* Temperature Control */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground">Lead Temperature</h4>
                  <div className="flex gap-2 items-center">
                    {record.temperatureOverride && (
                      <button 
                        onClick={() => unlockTempMutation.mutate()}
                        className="text-[10px] flex items-center gap-1 text-primary hover:underline font-bold bg-primary/10 px-2 py-1 rounded"
                      >
                        <Unlock className="w-3 h-3" /> Auto
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Current: <strong className="text-foreground">{record.temperature || "Warm"}</strong> {record.temperatureOverride ? "(Manual)" : "(Auto)"}</span>
                  <select 
                    className="bg-muted border border-border rounded p-1 text-xs font-bold"
                    value={record.temperature || "Warm"}
                    onChange={(e) => updateTempMutation.mutate(e.target.value)}
                    disabled={updateTempMutation.isPending}
                  >
                    <option value="Hot">🔥 Hot</option>
                    <option value="Warm">🟡 Warm</option>
                    <option value="Cold">🧊 Cold</option>
                  </select>
                </div>
              </div>

              {/* Secondary Contacts List */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground">Secondary Contacts</h4>
                  <button
                    onClick={() => setShowInquiriesModal(true)}
                    className="text-[10px] flex items-center gap-1 text-primary hover:underline font-bold bg-primary/10 px-2 py-1 rounded"
                  >
                    <Users className="w-3 h-3" /> View All Inquiries
                  </button>
                </div>
                {isLoadingContacts ? (
                  <p className="text-xs text-muted-foreground">Loading contacts...</p>
                ) : contacts.length > 0 ? (
                  <div className="space-y-3">
                    {contacts.map((contact, idx) => (
                      <ContactCard key={idx} contact={contact} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No additional contacts.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Related Inquiries Modal */}
      {record && (
        <RelatedInquiriesModal
          isOpen={showInquiriesModal}
          onClose={() => setShowInquiriesModal(false)}
          // Merge contacts into record for the modal
          lead={{...record, contacts: contacts}} 
        />
      )}
    </div>
  );
}
