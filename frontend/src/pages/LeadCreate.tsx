import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, Play, Save, ChevronRight, AlertCircle, Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function LeadCreate() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [leadType, setLeadType] = useState("General");
  const [source, setSource] = useState("website");
  const [expectedValue, setExpectedValue] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedGroups, setSelectedGroups] = useState<any[]>([]);

  // Speech recognition states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceExtraction, setVoiceExtraction] = useState<any | null>(null);
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [isVoiceCollapsed, setIsVoiceCollapsed] = useState(true);

  // New Customer inline form states
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContact, setNewCustomerContact] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerName.trim()) throw new Error("Customer name is required.");
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: newCustomerName,
          primaryContactName: newCustomerContact,
          email: newCustomerEmail,
          phone: newCustomerPhone
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setClientId(data.id);
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerContact("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Queries
  const { data: customers } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/customers", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    }
  });

  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch representatives");
      return res.json();
    }
  });

  const { data: leadSources } = useQuery<any[]>({
    queryKey: ["leadSources"],
    queryFn: async () => {
      const res = await fetch("/api/v1/lead-sources", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch lead sources");
      return res.json();
    }
  });

  const { data: requirements } = useQuery<any[]>({
    queryKey: ["requirements"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch master requirements");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      // Find client details
      const client = customers?.find(c => c.id === clientId);
      if (!client) throw new Error("Please select a client.");
      if (!projectName.trim()) throw new Error("Project name is required.");
      if (!notes.trim() && selectedGroups.length === 0) {
        throw new Error("Detailed Notes are required when no services are specified.");
      }

      // Split client name
      const nameParts = (client.primaryContactName || client.name).split(/\s+/);
      const firstName = nameParts[0] || "Client";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      const payload = {
        firstName,
        lastName,
        email: client.email || "no-email@example.com",
        phone: client.phone || "",
        company: client.name,
        projectName,
        assignedToId: salespersonId || null,
        industry: leadType,
        source,
        expectedValue: parseFloat(expectedValue) || 0,
        budgetRange: expectedValue ? `$${expectedValue}` : "",
        notes,
        status,
        categoriesData: selectedGroups,
        customerId: clientId
      };

      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      navigate("/leads");
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Handle adding service group templates from requirements catalog
  const handleAddServiceCategory = (requirementId: string) => {
    const req = requirements?.find(r => r.id === requirementId);
    if (!req) return;

    // Check if already added
    if (selectedGroups.some(g => g.requirementId === requirementId)) {
      alert("This category group has already been added.");
      return;
    }

    const items = req.lineItems?.map((li: any) => ({
      id: li.id,
      name: li.name,
      quantity: li.defaultQuantity || 1,
      unit: li.unit || "pcs",
      description: li.description || ""
    })) || [];

    setSelectedGroups(prev => [
      ...prev,
      {
        requirementId,
        categoryName: req.name,
        isExpanded: true,
        items
      }
    ]);
  };

  const handleRemoveGroup = (requirementId: string) => {
    setSelectedGroups(prev => prev.filter(g => g.requirementId !== requirementId));
  };

  const handleUpdateItemQty = (reqId: string, itemId: string, qty: number) => {
    setSelectedGroups(prev =>
      prev.map(g => {
        if (g.requirementId !== reqId) return g;
        return {
          ...g,
          items: g.items.map((item: any) => (item.id === itemId ? { ...item, quantity: qty } : item))
        };
      })
    );
  };

  // Web Speech API Recording
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition API is not supported in this browser. Please use Google Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setVoiceExtraction(null);
      };

      recognition.onerror = (e: any) => {
        console.error(e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      recognition.start();
    }
  };

  const handleParseTranscript = async () => {
    if (!transcript.trim()) return;
    setIsParsingVoice(true);

    try {
      const res = await fetch("/api/v1/leads/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transcript })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setVoiceExtraction(data);
    } catch (e: any) {
      console.error(e);
      alert("Failed to parse transcript: " + e.message);
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleFillFields = () => {
    if (!voiceExtraction) return;
    if (voiceExtraction.company) {
      // Find matching client
      const match = customers?.find(c => c.name.toLowerCase().includes(voiceExtraction.company.toLowerCase()));
      if (match) setClientId(match.id);
    }
    if (voiceExtraction.message) {
      setNotes(voiceExtraction.message);
      setProjectName(`Project: ${voiceExtraction.message.substring(0, 20)}...`);
    }
    if (voiceExtraction.budgetRange) {
      const numericVal = voiceExtraction.budgetRange.replace(/[^0-9]/g, "");
      if (numericVal) setExpectedValue(numericVal);
    }
    if (voiceExtraction.industry) {
      setLeadType(voiceExtraction.industry);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            <Link to="/leads" className="hover:text-primary">Leads</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </div>
          <h2 className="text-4xl font-bold text-on-surface">Add New Lead</h2>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => saveMutation.mutate({ status: "Draft" })}
            disabled={saveMutation.isPending}
            className="px-5 py-3 border border-outline-variant font-bold text-sm text-on-surface-variant hover:bg-surface-container rounded-lg transition-all"
          >
            Save as Draft
          </button>
          <button 
            onClick={() => saveMutation.mutate({ status: "Contacted" })}
            disabled={saveMutation.isPending}
            className="px-5 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            Save & Contact
          </button>
        </div>
      </div>

      {/* Voice Assistant Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
        <button 
          onClick={() => setIsVoiceCollapsed(!isVoiceCollapsed)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Voice Command Capture (Optional)
          </h3>
          <span className="text-xs font-bold text-primary hover:underline">
            {isVoiceCollapsed ? "Expand Voice Assistant" : "Collapse"}
          </span>
        </button>

        {!isVoiceCollapsed && (
          <div className="space-y-4 pt-2 border-t border-outline-variant/30 animate-fade-in">
            <p className="text-xs text-on-surface-variant">Tap Record, speak lead requirements (e.g., "Arjun at Tech Mahindra needs a proposal for prefab structural cabins with budget 50000"), and parse details directly into the form fields below.</p>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={toggleListening}
                className={`px-5 py-3 rounded-lg font-bold text-sm border flex items-center gap-2 transition-all ${
                  isListening ? "bg-error text-white border-error animate-pulse" : "bg-surface hover:bg-surface-container-low text-on-surface border-outline-variant"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-primary" />}
                {isListening ? "Stop Recording" : "Record Voice Note"}
              </button>

              {transcript && (
                <button 
                  onClick={handleParseTranscript}
                  disabled={isParsingVoice}
                  className="px-5 py-3 bg-secondary text-white font-bold text-sm rounded-lg hover:opacity-90 flex items-center gap-2 transition-all"
                >
                  {isParsingVoice && <Loader2 className="w-4 h-4 animate-spin" />}
                  Parse & Extract
                </button>
              )}

              {voiceExtraction && (
                <button 
                  onClick={handleFillFields}
                  className="px-5 py-3 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-all"
                >
                  Fill Fields
                </button>
              )}
            </div>

            {transcript && (
              <div className="bg-slate-50 border border-outline-variant rounded-xl p-4 text-sm whitespace-pre-line text-on-surface">
                <span className="font-bold text-xs text-on-surface-variant block uppercase tracking-wider mb-1.5">Live Transcript:</span>
                "{transcript}"
              </div>
            )}

            {voiceExtraction && (
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 text-sm space-y-2">
                <span className="font-bold text-xs text-emerald-800 block uppercase tracking-wider">Extracted Metadata:</span>
                <ul className="list-disc pl-5 space-y-1 text-emerald-900 font-medium">
                  <li><span className="font-bold">Contact Name:</span> {voiceExtraction.firstName} {voiceExtraction.lastName}</li>
                  <li><span className="font-bold">Email/Phone:</span> {voiceExtraction.email} | {voiceExtraction.phone}</li>
                  <li><span className="font-bold">Company:</span> {voiceExtraction.company}</li>
                  <li><span className="font-bold">Estimated Budget:</span> {voiceExtraction.budgetRange}</li>
                  <li><span className="font-bold">Description:</span> {voiceExtraction.message}</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead Information Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-on-surface border-b border-outline-variant pb-3">Lead Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Client / Customer</label>
              <button 
                type="button" 
                onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                className="text-xs font-bold text-primary hover:underline"
              >
                {showNewCustomerForm ? "Select Existing" : "+ New Customer Inline"}
              </button>
            </div>

            {showNewCustomerForm ? (
              <div className="bg-surface-container border border-outline rounded-xl p-4 space-y-3 animate-slide-down">
                <span className="text-xs font-bold text-on-surface-variant block uppercase tracking-wider">Create Customer Inline</span>
                <input 
                  type="text" 
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  placeholder="Company / Client Name *"
                  className="w-full bg-surface border border-outline rounded p-2 text-xs font-semibold focus:outline-none"
                />
                <input 
                  type="text" 
                  value={newCustomerContact}
                  onChange={e => setNewCustomerContact(e.target.value)}
                  placeholder="Primary Contact Name"
                  className="w-full bg-surface border border-outline rounded p-2 text-xs font-semibold focus:outline-none"
                />
                <input 
                  type="email" 
                  value={newCustomerEmail}
                  onChange={e => setNewCustomerEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-surface border border-outline rounded p-2 text-xs font-semibold focus:outline-none"
                />
                <input 
                  type="text" 
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full bg-surface border border-outline rounded p-2 text-xs font-semibold focus:outline-none"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowNewCustomerForm(false)} 
                    className="px-3 py-1.5 border border-outline rounded text-xs font-bold text-on-surface-variant"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => createCustomerMutation.mutate()} 
                    className="px-3 py-1.5 bg-primary text-white rounded text-xs font-bold"
                  >
                    Save Customer
                  </button>
                </div>
              </div>
            ) : (
              <select 
                value={clientId} 
                onChange={e => setClientId(e.target.value)}
                className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">Select a Customer</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.primaryContactName || "No contact"})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Assigned Salesperson</label>
            <select 
              value={salespersonId} 
              onChange={e => setSalespersonId(e.target.value)}
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">Select a Salesperson</option>
              {salespersons?.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Project / Requirement Name</label>
            <input 
              type="text" 
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Prefab cabin modules installation"
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Lead Type / Industry</label>
            <input 
              type="text" 
              value={leadType}
              onChange={e => setLeadType(e.target.value)}
              placeholder="e.g. Construction / IT"
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Source Channel</label>
            <select 
              value={source} 
              onChange={e => setSource(e.target.value)}
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              {leadSources?.map(s => (
                <option key={s.id} value={s.name}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Expected Value ($)</label>
            <input 
              type="number" 
              value={expectedValue}
              onChange={e => setExpectedValue(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Detailed Notes</label>
            <textarea 
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Provide specific notes or specifications..."
              className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Service Specifications Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-outline-variant pb-3">
          <h3 className="text-lg font-bold text-on-surface">Service Specifications</h3>
          
          <div className="flex items-center gap-2">
            <select 
              onChange={e => {
                if (e.target.value) {
                  handleAddServiceCategory(e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-surface border border-outline rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-primary focus:outline-none cursor-pointer"
            >
              <option value="">+ Add Service Group</option>
              {requirements?.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedGroups.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic py-4 text-center">No service groups added. Add a group from your Master Data deliverables list above.</p>
        ) : (
          <div className="space-y-6">
            {selectedGroups.map((group) => (
              <div key={group.requirementId} className="border border-outline-variant rounded-xl overflow-hidden shadow-sm bg-surface">
                
                <div className="p-4 bg-surface-container-low flex justify-between items-center border-b border-outline-variant">
                  <span className="font-bold text-sm text-on-surface">{group.categoryName}</span>
                  <button 
                    onClick={() => handleRemoveGroup(group.requirementId)}
                    className="p-1 text-error hover:bg-error-container hover:text-on-error-container rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold uppercase tracking-wider">
                        <th className="py-2">Item Name</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Unit</th>
                        <th className="py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {group.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-3 font-semibold text-on-surface">{item.name}</td>
                          <td className="py-3">
                            <input 
                              type="number"
                              value={item.quantity}
                              onChange={e => handleUpdateItemQty(group.requirementId, item.id, parseFloat(e.target.value) || 0)}
                              className="w-16 bg-surface border border-outline rounded p-1 text-center"
                            />
                          </td>
                          <td className="py-3 text-on-surface-variant font-medium">{item.unit}</td>
                          <td className="py-3 text-on-surface-variant italic">{item.description || "No description"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
