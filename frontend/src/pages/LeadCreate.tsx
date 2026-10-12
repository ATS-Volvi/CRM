import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { 
  Mic, 
  MicOff, 
  Save, 
  ChevronRight, 
  Trash2, 
  Loader2, 
  Sparkles, 
  Briefcase, 
  Layers, 
  CheckCircle2, 
  UserPlus, 
  X, 
  RotateCcw,
  Volume2
} from "lucide-react";

export default function LeadCreate() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const clientIdParam = searchParams.get("clientId");

  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState(clientIdParam || "");
  const [salespersonId, setSalespersonId] = useState(user?.id || "");
  const [leadType, setLeadType] = useState("General");
  const [source, setSource] = useState("Manual");
  const [expectedValue, setExpectedValue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!salespersonId && user?.id) {
      setSalespersonId(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (clientIdParam) {
      setClientId(clientIdParam);
    }
  }, [clientIdParam]);

  const [selectedGroups, setSelectedGroups] = useState<any[]>([]);

  // Speech recognition & audio analysis states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceExtraction, setVoiceExtraction] = useState<any | null>(null);
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState<string | null>(null);
  const [autoExtractOnStop, setAutoExtractOnStop] = useState(true);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // New Customer inline form states
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContact, setNewCustomerContact] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerName.trim()) throw new Error("Customer name is required.");
      let res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: newCustomerName,
          primaryContactName: newCustomerContact,
          email: newCustomerEmail,
          phone: newCustomerPhone
        })
      });
      if (!res.ok) {
        res = await fetch("/api/v1/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            name: newCustomerName,
            primaryContactName: newCustomerContact,
            email: newCustomerEmail,
            phone: newCustomerPhone
          })
        });
      }
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
      setVoiceStatusNotice(`Customer "${data.name}" registered and assigned.`);
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Queries
  const { data: customers } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      let res = await fetch("/api/v1/accounts", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) {
        res = await fetch("/api/v1/customers", { headers: { "Authorization": `Bearer ${token}` } });
      }
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

  const selectedClient = customers?.find(c => c.id === clientId);

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const client = customers?.find(c => c.id === clientId);
      if (!client) throw new Error("Please select a client.");
      if (!projectName.trim()) throw new Error("Project name is required.");
      if (!notes.trim() && selectedGroups.length === 0) {
        throw new Error("Detailed Notes are required when no services are specified.");
      }

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

  const handleAddServiceCategory = (requirementId: string) => {
    const req = requirements?.find(r => r.id === requirementId);
    if (!req) return;

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
          items: g.items.map((item: any) => (item.id === itemId ? { ...item, quantity: Math.max(0, qty) } : item))
        };
      })
    );
  };

  // Helper to parse spoken numbers like "50k", "50 thousand", "1.5 million"
  const parseSpokenBudget = (raw: string): string => {
    if (!raw) return "";
    const lower = raw.toLowerCase().trim();
    const millionMatch = lower.match(/([\d.]+)\s*(?:m|million)/i);
    if (millionMatch) {
      return String(Math.round(parseFloat(millionMatch[1]) * 1000000));
    }
    const thousandMatch = lower.match(/([\d.]+)\s*(?:k|thousand)/i);
    if (thousandMatch) {
      return String(Math.round(parseFloat(thousandMatch[1]) * 1000));
    }
    const cleanDigits = lower.replace(/[^0-9.]/g, "");
    if (cleanDigits) {
      const num = parseFloat(cleanDigits);
      return isNaN(num) ? "" : String(Math.round(num));
    }
    return "";
  };

  // Audio stream visualizer setup
  const startAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioVolume(Math.min(100, Math.round(avg * 1.5)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn("Audio analysis not available:", e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioVolume(0);
  };

  // Fine-tuned Web Speech API Integration
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let accumulatedFinal = transcript ? transcript + " " : "";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
      setVoiceStatusNotice("Listening... speak lead requirements, budget, or client name.");
      startAudioVisualizer();
    };

    recognition.onerror = (e: any) => {
      console.error("[SpeechRecognition Error]", e);
      setIsListening(false);
      stopAudioVisualizer();
      if (e.error === "not-allowed") {
        setVoiceStatusNotice("Microphone permission was denied. Please allow mic access.");
      } else {
        setVoiceStatusNotice(`Speech error: ${e.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAudioVisualizer();
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          accumulatedFinal += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const fullText = accumulatedFinal.trim();
      setTranscript(fullText);
      setInterimTranscript(interim);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    stopAudioVisualizer();

    const finalText = (transcript + " " + interimTranscript).trim();
    if (finalText) {
      setTranscript(finalText);
      setInterimTranscript("");
      if (autoExtractOnStop) {
        await executeVoiceExtraction(finalText);
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const executeVoiceExtraction = async (textToParse?: string) => {
    const raw = (textToParse || transcript).trim();
    if (!raw) return;
    setIsParsingVoice(true);
    setVoiceStatusNotice("Analyzing transcript with AI...");

    try {
      const res = await fetch("/api/v1/leads/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transcript: raw })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setVoiceExtraction(data);
      applyExtractedFields(data, raw);
    } catch (e: any) {
      console.error(e);
      setVoiceStatusNotice("Failed to parse transcript: " + e.message);
    } finally {
      setIsParsingVoice(false);
    }
  };

  const applyExtractedFields = (extraction: any, originalText: string) => {
    if (!extraction) return;
    let filledCount = 0;

    // 1. Company / Client Account Matching or Stage for Inline Create
    if (extraction.company) {
      const match = customers?.find(c => 
        c.name.toLowerCase().includes(extraction.company.toLowerCase()) ||
        extraction.company.toLowerCase().includes(c.name.toLowerCase())
      );

      if (match) {
        setClientId(match.id);
        filledCount++;
      } else {
        // Stage for instant inline creation
        setNewCustomerName(extraction.company);
        if (extraction.firstName || extraction.lastName) {
          setNewCustomerContact(`${extraction.firstName || ""} ${extraction.lastName || ""}`.trim());
        }
        if (extraction.email && !extraction.email.includes("example.com")) {
          setNewCustomerEmail(extraction.email);
        }
        if (extraction.phone && !extraction.phone.includes("555-0199")) {
          setNewCustomerPhone(extraction.phone);
        }
        setShowNewCustomerForm(true);
        filledCount++;
      }
    }

    // 2. Project Name
    if (extraction.subject || extraction.message) {
      const baseDesc = extraction.subject || extraction.message;
      const cleanProject = baseDesc.replace(/^(this is|i am|we need|project:)\s*/i, "").trim();
      setProjectName(cleanProject.length > 50 ? cleanProject.substring(0, 47) + "..." : cleanProject);
      filledCount++;
    }

    // 3. Expected Value / Budget
    if (extraction.budgetRange) {
      const parsedVal = parseSpokenBudget(extraction.budgetRange);
      if (parsedVal) {
        setExpectedValue(parsedVal);
        filledCount++;
      }
    }

    // 4. Industry
    if (extraction.industry && extraction.industry !== "General") {
      setLeadType(extraction.industry);
      filledCount++;
    }

    // 5. Notes
    if (extraction.message || originalText) {
      setNotes(extraction.message || originalText);
      filledCount++;
    }

    // 6. Source
    setSource("Voice Inbound");

    // 7. Salesperson detection from transcript
    if (salespersons && salespersons.length > 0) {
      const lowerText = originalText.toLowerCase();
      const matchedRep = salespersons.find(s => lowerText.includes(s.name.toLowerCase()));
      if (matchedRep) {
        setSalespersonId(matchedRep.id);
        filledCount++;
      }
    }

    setVoiceStatusNotice(`✨ ${filledCount} fields auto-populated by AI Copilot!`);
  };

  const handleClearVoice = () => {
    if (isListening) {
      stopListening();
    }
    setTranscript("");
    setInterimTranscript("");
    setVoiceExtraction(null);
    setVoiceStatusNotice(null);
  };

  // Cleanup audio tracks on unmount
  useEffect(() => {
    return () => {
      stopAudioVisualizer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  const quickIndustryTags = ["General", "Prefab & Infra", "Construction", "IT & Cloud", "Commercial", "Consulting"];

  // Compute total item count
  const totalItemCount = selectedGroups.reduce((acc, g) => acc + g.items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0), 0);

  return (
    <div className="w-full max-w-[1350px] mx-auto p-4 md:p-6 space-y-4 animate-fade-in font-sans">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
            <Link to="/leads" className="hover:text-blue-600 transition-colors">Leads</Link>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-800 font-bold">New Lead</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Create New Lead</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Copilot Active
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={() => saveMutation.mutate({ status: "Draft" })}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            Save Draft
          </button>
          <button 
            type="button"
            onClick={() => saveMutation.mutate({ status: "Contacted" })}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Save & Contact
          </button>
        </div>
      </div>

      {/* Fine-Tuned Voice & AI Copilot Strip */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 shadow-md border border-slate-800 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Mic Button & Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleListening}
              className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all flex-shrink-0 cursor-pointer ${
                isListening 
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/50 ring-4 ring-red-400/40 animate-pulse" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:scale-105 active:scale-95"
              }`}
              title={isListening ? "Stop Recording & Parse" : "Start Voice Recording"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs tracking-wide text-white">Voice & AI Command Copilot</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isListening 
                    ? "bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse" 
                    : isParsingVoice
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-blue-500/20 text-blue-300 border border-blue-400/20"
                }`}>
                  {isListening ? "🔴 Recording Live" : isParsingVoice ? "⚡ AI Parsing..." : "Ready"}
                </span>
                
                {/* Auto-Extract toggle */}
                <label className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-300 font-medium cursor-pointer ml-2">
                  <input 
                    type="checkbox" 
                    checked={autoExtractOnStop} 
                    onChange={e => setAutoExtractOnStop(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 w-3 h-3 cursor-pointer"
                  />
                  <span>Auto-fill on stop</span>
                </label>
              </div>

              <p className="text-[11px] text-slate-300 mt-0.5">
                {voiceStatusNotice || (isListening 
                  ? "Speak naturally — continuous streaming active. Click mic again when done."
                  : "Click the mic to speak client names, requirements, budget (e.g. '$75k'), and deal terms.")}
              </p>
            </div>
          </div>

          {/* Dynamic Voice Activity Waveform */}
          <div className="flex items-center gap-1.5 self-center">
            {[20, 50, 30, 80, 45, 95, 60, 35, 70, 25].map((baseHeight, idx) => {
              const liveHeight = isListening 
                ? Math.max(8, Math.min(28, (baseHeight * (audioVolume || 20)) / 60))
                : 8;
              return (
                <span
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isListening ? "bg-blue-400" : "bg-slate-600 opacity-40"
                  }`}
                  style={{ height: `${liveHeight}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Live Streaming Transcript & Quick Extraction Actions */}
        {(transcript || interimTranscript || voiceExtraction) && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
            {(transcript || interimTranscript) && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-800/80 rounded-lg p-2.5 border border-slate-700 text-xs">
                <div className="flex items-start gap-2 overflow-hidden flex-1">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-slate-200 text-xs">
                    <span className="font-medium text-slate-100">{transcript}</span>
                    {interimTranscript && (
                      <span className="text-blue-300 italic font-semibold ml-1 animate-pulse">
                        {interimTranscript}...
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => executeVoiceExtraction()}
                    disabled={isParsingVoice || isListening}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[11px] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isParsingVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    ⚡ Parse & Fill
                  </button>
                  <button
                    type="button"
                    onClick={handleClearVoice}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                    title="Clear transcript"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Extracted Entities Tag Pills */}
            {voiceExtraction && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Extracted by AI:</span>
                {voiceExtraction.company && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                    🏢 <strong>{voiceExtraction.company}</strong>
                  </span>
                )}
                {voiceExtraction.firstName && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                    👤 <strong>{voiceExtraction.firstName} {voiceExtraction.lastName}</strong>
                  </span>
                )}
                {voiceExtraction.budgetRange && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                    💰 <strong>{voiceExtraction.budgetRange}</strong>
                  </span>
                )}
                {voiceExtraction.industry && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                    🏷️ <strong>{voiceExtraction.industry}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Lead & Opportunity Information Card - Fully Packed Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lead & Account Details</h2>
              <p className="text-[11px] text-slate-500">Core client relationship and deal requirements</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1 rounded-md transition-colors"
          >
            {showNewCustomerForm ? (
              <>
                <X className="w-3.5 h-3.5" /> Cancel Inline
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" /> + New Customer Inline
              </>
            )}
          </button>
        </div>

        {/* Inline Customer Form if toggled */}
        {showNewCustomerForm && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-blue-200 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Create Customer Account
              </span>
              <span className="text-[10px] text-slate-500">Saves directly to Master Data</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input 
                type="text" 
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                placeholder="Company / Client Name *"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <input 
                type="text" 
                value={newCustomerContact}
                onChange={e => setNewCustomerContact(e.target.value)}
                placeholder="Primary Contact Full Name"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <input 
                type="email" 
                value={newCustomerEmail}
                onChange={e => setNewCustomerEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <input 
                type="text" 
                value={newCustomerPhone}
                onChange={e => setNewCustomerPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowNewCustomerForm(false)} 
                className="px-2.5 py-1 border border-slate-300 hover:bg-slate-100 rounded text-xs font-medium text-slate-600"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => createCustomerMutation.mutate()} 
                disabled={createCustomerMutation.isPending}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1"
              >
                {createCustomerMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Customer
              </button>
            </div>
          </div>
        )}

        {/* Dense Unified Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          
          {/* Row 1: Client Account (8 cols) & Salesperson (4 cols) */}
          <div className="md:col-span-8 space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Client / Customer Account <span className="text-red-500">*</span>
              </label>
              {selectedClient && (
                <span className="text-[11px] text-emerald-700 font-semibold">
                  ✓ {selectedClient.primaryContactName || selectedClient.email || "Contact linked"}
                </span>
              )}
            </div>
            <select 
              value={clientId} 
              onChange={e => setClientId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="">Select an Existing Customer...</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.primaryContactName ? `(${c.primaryContactName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Assigned Representative <span className="text-red-500">*</span>
            </label>
            <select 
              value={salespersonId} 
              onChange={e => setSalespersonId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="">Select a Representative...</option>
              {salespersons?.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role || "Sales Rep"})
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Project Name (8 cols) & Expected Value (4 cols) */}
          <div className="md:col-span-8 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Project / Requirement Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Prefab Cabin Modules Installation - Phase 1"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Expected Value ($)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                $
              </div>
              <input 
                type="number" 
                value={expectedValue}
                onChange={e => setExpectedValue(e.target.value)}
                placeholder="25000"
                className="w-full pl-6 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm tabular-nums"
              />
            </div>
          </div>

          {/* Row 3: Industry & Chips (8 cols) & Source Channel (4 cols) */}
          <div className="md:col-span-8 space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Lead Type / Industry
              </label>
              {/* Quick tags */}
              <div className="hidden sm:flex flex-wrap gap-1">
                {quickIndustryTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setLeadType(tag)}
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border transition-all ${
                      leadType === tag 
                        ? "bg-blue-50 text-blue-700 border-blue-300 font-bold" 
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <input 
              type="text" 
              value={leadType}
              onChange={e => setLeadType(e.target.value)}
              placeholder="e.g. Construction / IT"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Source Channel
            </label>
            <select 
              value={source} 
              onChange={e => setSource(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm cursor-pointer"
            >
              {leadSources?.map(s => (
                <option key={s.id} value={s.name}>
                  {s.name.charAt(0).toUpperCase() + s.name.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Detailed Notes (Full 12 cols) */}
          <div className="md:col-span-12 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Detailed Notes & Scope Specifications
            </label>
            <textarea 
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Provide specific client notes, structural scopes, or requirements..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-normal focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none shadow-sm"
            />
          </div>

        </div>
      </div>

      {/* Service Specifications & Deliverables Matrix Card - High Density */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Service Specifications & Scope Deliverables</h2>
              <p className="text-[11px] text-slate-500">Pick template deliverables packages and tune item quantities</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              onChange={e => {
                if (e.target.value) {
                  handleAddServiceCategory(e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="">+ Add Deliverable Package</option>
              {requirements?.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedGroups.length === 0 ? (
          <div className="p-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-500">
              <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>No deliverable packages configured yet. Use the dropdown above to add line items from your catalog.</span>
            </div>
            <div className="flex-shrink-0 text-slate-400 text-[11px] font-medium">
              Optional for lead creation
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {selectedGroups.map((group) => (
              <div key={group.requirementId} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                
                {/* Group Title Bar */}
                <div className="px-3.5 py-2 bg-slate-50 flex justify-between items-center border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{group.categoryName}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                      {group.items.length} Items
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleRemoveGroup(group.requirementId)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove Package"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">Item Name</th>
                        <th className="py-2 px-3 w-32">Quantity</th>
                        <th className="py-2 px-3 w-20">Unit</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-900">{item.name}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center border border-slate-300 rounded overflow-hidden bg-white w-24 shadow-sm">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(group.requirementId, item.id, (item.quantity || 1) - 1)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold border-r border-slate-200 text-[11px]"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                value={item.quantity}
                                onChange={e => handleUpdateItemQty(group.requirementId, item.id, parseFloat(e.target.value) || 0)}
                                className="w-full text-center text-xs font-bold text-slate-900 focus:outline-none p-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(group.requirementId, item.id, (item.quantity || 1) + 1)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold border-l border-slate-200 text-[11px]"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{item.unit}</td>
                          <td className="py-2 px-3 text-slate-500 italic max-w-xs truncate">{item.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}

            {/* Scope Summary Footer */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 text-[11px]">
                Total Packages Configured: <strong className="text-slate-900">{selectedGroups.length}</strong>
              </span>
              <span className="font-semibold text-slate-600 text-[11px]">
                Total Deliverable Units: <strong className="text-blue-600 font-bold">{totalItemCount}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Quick Action Dock */}
      <div className="flex items-center justify-between p-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg sticky bottom-4 z-20">
        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          {selectedClient ? (
            <span>Ready to ingest lead for <strong className="text-slate-800">{selectedClient.name}</strong></span>
          ) : (
            <span>Select customer account and enter project name to proceed</span>
          )}
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button 
            type="button"
            onClick={() => saveMutation.mutate({ status: "Draft" })}
            disabled={saveMutation.isPending}
            className="px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            Save Draft
          </button>
          <button 
            type="button"
            onClick={() => saveMutation.mutate({ status: "Contacted" })}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Save & Contact
          </button>
        </div>
      </div>

    </div>
  );
}
