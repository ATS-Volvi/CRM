import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  User,
  Target,
  CheckCircle2,
  ArrowRight,
  X,
  AlertCircle,
  Plus,
  Search
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface LeadConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    company?: string;
    email?: string;
    phone?: string;
    estimatedValue?: number;
    budgetRange?: string;
    assignedToId?: string;
    leadScore?: number;
    accountId?: string;
  };
  onConverted?: (result: any) => void;
}

export const LeadConversionModal: React.FC<LeadConversionModalProps> = ({
  isOpen,
  onClose,
  lead,
  onConverted
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversionSuccess, setConversionSuccess] = useState<any | null>(null);

  // Account State
  const [accountMode, setAccountMode] = useState<"existing" | "new">("new");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(lead.accountId || "");
  const [newAccountName, setNewAccountName] = useState(
    lead.company || `${lead.firstName} ${lead.lastName}`.trim()
  );

  // Contact State
  const [contactMode, setContactMode] = useState<"existing" | "new">("new");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [newContactFirstName, setNewContactFirstName] = useState(lead.firstName || "");
  const [newContactLastName, setNewContactLastName] = useState(lead.lastName || "");
  const [newContactEmail, setNewContactEmail] = useState(lead.email || "");
  const [newContactPhone, setNewContactPhone] = useState(lead.phone || "");

  // Opportunity State
  const [opportunityName, setOpportunityName] = useState(
    `${lead.company || lead.firstName} — Commercial Requirement`
  );
  const [estimatedValue, setEstimatedValue] = useState<number>(
    lead.estimatedValue || (lead.leadScore ? lead.leadScore * 10000 : 500000)
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [requirementSummary, setRequirementSummary] = useState(
    "Turnkey requirement qualified from pre-sales lead conversation."
  );

  // Fetch candidate existing accounts
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConversionSuccess(null);
      apiClient
        .get("/api/v1/accounts?limit=50")
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res.data || [];
          setAccounts(list);
          // Check if existing account matches company name
          if (lead.company) {
            const match = list.find(
              (a: any) => a.name.toLowerCase() === lead.company?.toLowerCase()
            );
            if (match) {
              setSelectedAccountId(match.id);
              setAccountMode("existing");
            }
          }
        })
        .catch((err) => console.error("Error loading accounts:", err));
    }
  }, [isOpen, lead]);

  // Fetch candidate contacts if existing account selected
  useEffect(() => {
    if (selectedAccountId && accountMode === "existing") {
      apiClient
        .get(`/api/v1/contacts?accountId=${selectedAccountId}`)
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res.data || [];
          setContacts(list);
          if (list.length > 0) {
            const match = list.find(
              (c: any) =>
                (lead.email && c.email === lead.email) ||
                (c.firstName === lead.firstName && c.lastName === lead.lastName)
            );
            if (match) {
              setSelectedContactId(match.id);
              setContactMode("existing");
            }
          }
        })
        .catch((err) => console.error("Error loading contacts:", err));
    }
  }, [selectedAccountId, accountMode, lead]);

  if (!isOpen) return null;

  const handleConvert = async () => {
    setLoading(true);
    setError(null);

    try {
      const reqText = (requirementSummary || "").trim() || (lead.subject || "").trim() || (lead.company || "").trim() || "Turnkey requirement qualified from pre-sales lead conversation.";
      const estVal = Number(estimatedValue) || 500000;

      const payload: any = {
        requirement: reqText,
        estimatedValue: estVal,
        qualificationData: {
          requirement: reqText,
          estimatedValue: estVal,
          budget: lead.budgetRange || "Standard",
          timeline: "Within 30 Days",
          decisionMaker: `${newContactFirstName} ${newContactLastName}`.trim() || "Decision Maker",
          notes: `Converted from Lead #${lead.id}`
        }
      };

      if (accountMode === "existing" && selectedAccountId) {
        payload.accountId = selectedAccountId;
      }
      if (contactMode === "existing" && selectedContactId) {
        payload.contactId = selectedContactId;
      }

      const res = await apiClient.post(`/api/v1/leads/${lead.id}/convert`, payload);
      setConversionSuccess(res);
      if (onConverted) onConverted(res);
    } catch (err: any) {
      setError(err.message || "Failed to convert lead into opportunity.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOpportunity = () => {
    if (conversionSuccess?.deal?.id) {
      navigate(`/opportunities/${conversionSuccess.deal.id}`);
    } else {
      navigate("/pipeline");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" /> Convert Lead to Opportunity
            </h3>
            <p className="text-[11px] text-slate-500">
              Transform this qualified enquiry into a formal commercial sales requirement.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success State */}
          {conversionSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Lead Converted Successfully!</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  The pre-sales enquiry has been closed, and unified records have been established:
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-left text-xs space-y-1.5 max-w-md mx-auto">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    <strong>Account:</strong> {conversionSuccess.account?.name || newAccountName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    <strong>Contact:</strong> {conversionSuccess.contact?.firstName || newContactFirstName}{" "}
                    {conversionSuccess.contact?.lastName || newContactLastName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    <strong>Opportunity:</strong> {conversionSuccess.deal?.name || opportunityName}
                  </span>
                </div>
              </div>

              <button
                onClick={handleOpenOpportunity}
                className="enterprise-btn-primary mx-auto px-5 py-2"
              >
                <span>Open Opportunity Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: ACCOUNT */}
              <div className="space-y-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> 1. Account (Company)
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAccountMode("new")}
                      className={`px-2 py-0.5 rounded font-semibold ${
                        accountMode === "new"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      Create New
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountMode("existing")}
                      className={`px-2 py-0.5 rounded font-semibold ${
                        accountMode === "existing"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      Select Existing
                    </button>
                  </div>
                </div>

                {accountMode === "new" ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Account / Company Name
                    </label>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="enterprise-input w-full"
                      placeholder="e.g. Gulf Manufacturing Co."
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Select Existing Account
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="enterprise-input w-full"
                    >
                      <option value="">-- Choose Account --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.industry || "General"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* SECTION 2: CONTACT */}
              <div className="space-y-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" /> 2. Primary Contact
                  </span>
                  {accountMode === "existing" && contacts.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setContactMode("new")}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          contactMode === "new"
                            ? "bg-blue-600 text-white"
                            : "text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        New Contact
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactMode("existing")}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          contactMode === "existing"
                            ? "bg-blue-600 text-white"
                            : "text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        Existing
                      </button>
                    </div>
                  )}
                </div>

                {contactMode === "new" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={newContactFirstName}
                        onChange={(e) => setNewContactFirstName(e.target.value)}
                        className="enterprise-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={newContactLastName}
                        onChange={(e) => setNewContactLastName(e.target.value)}
                        className="enterprise-input w-full"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="enterprise-input w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Select Existing Contact
                    </label>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="enterprise-input w-full"
                    >
                      <option value="">-- Choose Contact --</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.email || c.phone || "No direct email"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* SECTION 3: OPPORTUNITY */}
              <div className="space-y-2 border border-slate-200 rounded-lg p-3.5 bg-slate-50/40">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" /> 3. Commercial Opportunity
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Opportunity Name
                    </label>
                    <input
                      type="text"
                      value={opportunityName}
                      onChange={(e) => setOpportunityName(e.target.value)}
                      className="enterprise-input w-full"
                      placeholder="e.g. SCADA System Modernization Phase 1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Estimated Deal Value (INR)
                      </label>
                      <input
                        type="number"
                        value={estimatedValue}
                        onChange={(e) => setEstimatedValue(Number(e.target.value))}
                        className="enterprise-input w-full font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        type="date"
                        value={expectedCloseDate}
                        onChange={(e) => setExpectedCloseDate(e.target.value)}
                        className="enterprise-input w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Scope / Requirement Summary
                    </label>
                    <textarea
                      rows={2}
                      value={requirementSummary}
                      onChange={(e) => setRequirementSummary(e.target.value)}
                      className="enterprise-input w-full resize-none text-xs"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!conversionSuccess && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
            <button type="button" onClick={onClose} className="enterprise-btn-outline">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConvert}
              disabled={loading || !opportunityName || !estimatedValue}
              className="enterprise-btn-primary px-4"
            >
              {loading ? (
                <span>Converting...</span>
              ) : (
                <>
                  <span>Complete Conversion</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
