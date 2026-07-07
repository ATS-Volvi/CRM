import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { 
  ArrowLeft, Mail, Phone, Building2, MapPin, Globe, CheckCircle2, 
  Sparkles, Clock, Calendar, CheckSquare, MessageSquare, Plus, ArrowLeftRight,
  FileText, Users, DollarSign, Activity, ChevronRight, TrendingUp, Repeat, FileSpreadsheet, ShoppingBag
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function LeadDetail() {
  const { id } = useParams();

  // We fetch a mock lead detail from our API
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      // For mock purposes we can just use the leads endpoint and find one,
      // but let's assume the API handles /leads/:id. We'll fallback to a static mock
      // if the endpoint isn't fully robust yet.
      const res = await fetch(`/api/v1/leads`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      const leads = await res.json();
      return leads[0] || null; 
    }
  });

  return (
    <div className="flex-1 overflow-y-auto bg-background h-[calc(100vh-64px)]">
      {/* Action Bar & Breadcrumbs */}
      <div className="px-8 py-4 bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-on-surface-variant text-sm">
          <a className="hover:text-primary" href="/leads">Leads</a>
          <ChevronRight className="w-4 h-4" />
          <span className="font-bold text-on-surface">{isLoading ? 'Loading...' : 'Arjun Mehta (Tech Mahindra)'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-outline text-on-surface font-bold rounded-lg hover:bg-surface-container-low transition-all">
            <Phone className="w-5 h-5" />
            <span className="text-sm">Log Call</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-outline text-on-surface font-bold rounded-lg hover:bg-surface-container-low transition-all">
            <Mail className="w-5 h-5" />
            <span className="text-sm">Send Email</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-secondary text-secondary font-bold rounded-lg hover:bg-secondary-container/20 transition-all">
            <FileText className="w-5 h-5" />
            <span className="text-sm">Create Quote</span>
          </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold rounded hover:bg-primary/20 transition-colors text-sm">
                  <Sparkles className="w-4 h-4" />
                  Auto-Enrich
                </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all">
            <Calendar className="w-5 h-5" />
            <span className="text-sm">Schedule Meeting</span>
          </button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-12 gap-8 max-w-[1440px] mx-auto">
        {/* Left Column: Profile & Context */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Main Profile Card */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary-container">
                  <span className="text-2xl font-bold">AM</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Arjun Mehta</h2>
                  <p className="text-sm text-on-surface-variant font-medium">VP of Product Innovation</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">High Intent</span>
                    <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">LinkedIn Lead</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Lead Score</p>
                <p className="text-3xl font-bold text-primary">89</p>
              </div>
            </div>

            <div className="space-y-4 border-t border-outline-variant pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm font-medium">Tech Mahindra (Bengaluru, India)</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm">arjun.m@techmahindra.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm">+91 98450 12345</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
              <p className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-2">Source Campaign</p>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                <span className="text-sm font-bold text-on-surface">Q3 APAC Growth Summit</span>
              </div>
            </div>
          </div>

          {/* Auto-Enrichment Insights */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm relative overflow-hidden">
              <span className="text-primary/40"><Sparkles className="w-6 h-6" /></span>
            <h3 className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-6">Smart Insights</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Company Size</p>
                <p className="text-sm font-bold text-on-surface">10,000+ Employees</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">HQ Location</p>
                <p className="text-sm font-bold text-on-surface">Mumbai, IN</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Industry</p>
                <p className="text-sm font-bold text-on-surface">IT Services</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Revenue</p>
                <p className="text-sm font-bold text-on-surface">{formatCurrencyCompact(5300000000)}</p>
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h3 className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-6">Ownership</h3>
            <div className="flex items-center justify-between p-2 border border-outline-variant rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">RV</div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Rahul Varma</p>
                  <p className="text-[12px] font-semibold tracking-wider uppercase text-primary">Senior Account Exec</p>
                </div>
              </div>
              <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <Repeat className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-on-surface">Activity Timeline</h3>
              <div className="flex gap-2">
                <button className="text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full bg-surface-container-high text-primary">All Activity</button>
                <button className="text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container">Communications</button>
                <button className="text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container">Documents</button>
              </div>
            </div>

            <div className="relative space-y-8 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant">
              
              {/* Timeline Item: Stage Change */}
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-primary-container/20 border-4 border-surface flex items-center justify-center z-10 text-primary">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="bg-surface-container p-4 rounded-lg border border-outline-variant/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold">Lead Stage Updated to <span className="text-primary">Proposal</span></p>
                    <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Just now</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">System automatically updated stage based on quotation generation.</p>
                </div>
              </div>

              {/* Timeline Item: Quote Event */}
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-secondary/10 border-4 border-surface flex items-center justify-center z-10 text-secondary">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold">Quotation Created: #Q-45920</p>
                    <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between bg-surface-bright p-2 rounded border border-outline-variant/30">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Enterprise Suite License.pdf</p>
                        <p className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">{formatCurrency(24500)}</p>
                      </div>
                    </div>
                    <button className="text-primary font-bold text-[12px] tracking-wider uppercase">VIEW</button>
                  </div>
                </div>
              </div>

              {/* Timeline Item: Email */}
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-tertiary-fixed border-4 border-surface flex items-center justify-center z-10 text-tertiary">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold">Outbound Email Sent</p>
                    <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Yesterday, 4:30 PM</span>
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2">"Hi Arjun, Great connecting with you today. As promised, I've attached the case studies for the BFSI sector..."</p>
                </div>
              </div>

              {/* Timeline Item: Meeting */}
              <div className="relative pl-12">
                  <Users className="w-5 h-5" />
                <div className="p-4 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold">Discovery Call - Technical Requirements</p>
                    <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Oct 24, 10:00 AM</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-on-surface-variant">Google Meet</span>
                  </div>
                  <p className="text-sm bg-surface-container-low p-2 rounded border-l-4 border-primary">Discussed security compliance and API integration needs for their Mumbai data center.</p>
                </div>
              </div>

              {/* Timeline Item: Call */}
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-error-container border-4 border-surface flex items-center justify-center z-10 text-error">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold">Call Missed</p>
                    <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Oct 22, 2:15 PM</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">Inbound call from Arjun Mehta. No voicemail left.</p>
                </div>
              </div>

              {/* Timeline Item: PO */}
              <div className="relative pl-12 opacity-50">
                  <ShoppingBag className="w-5 h-5" />
                <div className="p-4 rounded-lg border border-dashed border-outline-variant">
                  <p className="text-sm italic">No Purchase Orders recorded yet.</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
