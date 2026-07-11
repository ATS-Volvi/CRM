import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  GripVertical, Package, Globe, RefreshCw, Award, 
  ArrowRight, Users, Map, Repeat, Delete, Plus, Home,
  Sliders, CalendarOff
} from "lucide-react";

export default function AssignmentRules() {
  const { token } = useAuth();

  const { data: rules, isLoading } = useQuery({
    queryKey: ["assignmentRules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment-rules", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch assignment rules");
      return res.json();
    }
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      {/* Top Bar Shell */}
      <header className="h-16 flex justify-between items-center px-8 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-on-surface">Assignment Rules Builder</h2>
          <div className="h-4 w-[1px] bg-outline-variant"></div>
          <div className="flex items-center gap-2 text-primary font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm">Real-time distribution active</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-primary text-on-primary px-4 py-2 rounded-lg text-[12px] font-bold shadow-sm hover:opacity-90 transition-all">+ Quick Add</button>
        </div>
      </header>

      {/* Builder Workspace */}
      <div className="p-8 flex gap-8 max-w-[1440px] mx-auto w-full">
        {/* Rules List Area */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Lead Distribution Hierarchy</h3>
              <p className="text-sm text-on-surface-variant">Rules are executed in order. Drag to prioritize.</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-secondary font-bold text-[12px] uppercase border border-secondary rounded-lg hover:bg-surface-container">Export Logic</button>
              <button className="px-4 py-2 bg-primary text-on-primary font-bold text-[12px] uppercase rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create New Rule
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant animate-pulse">Loading rules...</div>
          ) : (
            rules?.map((rule: any, i: number) => {
              const isActive = rule.isActive ?? rule.active ?? true;
              const ruleName = rule.name || `Assignment Rule ${rule.priority || i+1}`;
              const ruleDesc = rule.description || `Priority: ${rule.priority || 'Standard'}`;
              const ruleCondition = rule.criteria || rule.condition || 'All Leads';
              const ruleAction = (rule.assignTo ? `Assign to ${rule.assignTo.name}` : rule.action) || 'No action';
              const ruleType = (rule.ruleType || rule.type || 'round-robin').toLowerCase();

              const renderCriteria = (criteriaStr: string) => {
                if (!criteriaStr) return <span className="text-sm font-medium text-on-surface-variant">All Leads</span>;
                try {
                  const parsed = JSON.parse(criteriaStr);
                  if (Array.isArray(parsed)) {
                    return parsed.map((c: any, idx: number) => {
                      const fieldName = c.field 
                        ? c.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()) 
                        : "";
                      let op = c.operator || "=";
                      if (op === "equals") op = "=";
                      if (op === "greaterThan") op = ">";
                      if (op === "lessThan") op = "<";
                      
                      return (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-container text-on-primary-container border border-primary/20">
                          <span className="opacity-80">{fieldName}</span>
                          <span className="text-primary font-extrabold">{op}</span>
                          <span className="font-extrabold">"{c.value}"</span>
                        </span>
                      );
                    });
                  }
                } catch (e) {
                  // Fallback if not JSON
                }
                return <span className="text-sm font-medium text-on-surface">{criteriaStr}</span>;
              };

              return (
              <div key={rule.id} className={`bg-surface-container-lowest border ${!isActive ? 'border-outline-variant/50 opacity-60 bg-surface' : 'border-outline-variant'} rounded-xl p-4 flex items-center gap-4 group hover:shadow-md transition-shadow`}>
                <div className={`cursor-move ${!isActive ? 'opacity-20' : 'opacity-40 group-hover:opacity-100'} text-outline flex-shrink-0`}>
                  <GripVertical className="w-6 h-6" />
                </div>
                
                {/* Icon mapping based on rule type */}
                <div className={`w-10 h-10 rounded flex-shrink-0 flex items-center justify-center 
                  ${ruleType === 'product' ? 'bg-primary-container/20 text-primary' : 
                    ruleType === 'geo' ? 'bg-tertiary-container/20 text-tertiary' : 
                    ruleType === 'round-robin' ? 'bg-secondary/10 text-secondary' : 
                    ruleType === 'criteria' ? 'bg-primary/10 text-primary' :
                    'bg-outline-variant/20 text-outline'}`}>
                  {ruleType === 'product' && <Package className="w-6 h-6" />}
                  {ruleType === 'geo' && <Globe className="w-6 h-6" />}
                  {ruleType === 'round-robin' && <RefreshCw className="w-6 h-6" />}
                  {ruleType === 'skill' && <Award className="w-6 h-6" />}
                  {ruleType === 'criteria' && <Sliders className="w-6 h-6" />}
                </div>

                <div className="flex-1 grid grid-cols-12 items-center gap-4 min-w-0">
                  <div className="col-span-4 min-w-0">
                    <h4 className="text-base font-bold text-on-surface truncate">{ruleName}</h4>
                    <p className="text-sm text-on-surface-variant truncate">{ruleDesc}</p>
                  </div>
                  <div className="col-span-4 flex items-center gap-2 flex-wrap min-w-0">
                    <div className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant text-[11px] font-bold rounded uppercase border border-outline-variant/30 flex-shrink-0">IF</div>
                    {isActive ? (
                      <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                        {renderCriteria(ruleCondition)}
                      </div>
                    ) : (
                      <span className="text-sm font-medium italic text-on-surface-variant">Disabled</span>
                    )}
                  </div>
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <ArrowRight className="w-5 h-5 text-outline flex-shrink-0" />
                    {isActive ? (
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border truncate
                        ${ruleType === 'product' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                          ruleType === 'geo' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                          'bg-primary/10 text-primary border-primary/20'}`}>
                        {ruleType === 'product' && <Users className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'geo' && <Map className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'round-robin' && <Repeat className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'criteria' && <Users className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate">{ruleAction}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-outline truncate">No action assigned</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only toggle-switch" defaultChecked={isActive} />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${isActive ? 'bg-primary' : 'bg-outline-variant'}`}>
                      <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'left-6' : 'left-1'}`}></div>
                    </div>
                  </label>
                  <Delete className="w-6 h-6 text-outline cursor-pointer hover:text-error" />
                </div>
              </div>
            );
            })
          )}

          {/* Fallback Rule */}
          <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-xl p-4 flex items-center gap-4 mt-6">
            <div className="w-10 h-10 rounded-full bg-outline-variant/30 flex items-center justify-center text-on-surface-variant">
              <Home className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-on-surface">Global Fallback</h4>
              <p className="text-sm text-on-surface-variant">If no rules match, assign to <span className="font-bold underline">Sales Ops Manager</span></p>
            </div>
            <button className="text-primary font-bold text-[12px] uppercase">Edit Strategy</button>
          </div>
        </div>

        {/* Right Sidebar: Capacity & Status */}
        <aside className="w-80 flex flex-col gap-6">
          {/* Capacity Meter Widget */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[12px] font-bold uppercase text-on-surface-variant">Agent Capacity</h4>
              <Sliders className="w-5 h-5 text-outline" />
            </div>
            <div className="space-y-6">
              {/* Agent Item */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">Ahmed K.</span>
                  <span className="text-on-surface-variant">14 / 20 leads</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              {/* Agent Item (At limit) */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">Sarah L.</span>
                  <span className="text-error font-bold">19 / 20 leads</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '95%' }}></div>
                </div>
              </div>
              {/* Agent Item */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">Rahul M.</span>
                  <span className="text-on-surface-variant">5 / 15 leads</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '33%' }}></div>
                </div>
              </div>
              {/* Agent Item */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">Jessica W.</span>
                  <span className="text-on-surface-variant">12 / 12 leads</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
            </div>
            <button className="w-full mt-6 py-2 text-primary font-bold text-[12px] uppercase border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">Balance All Limits</button>
          </section>

          {/* Out of Office Status */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex-1">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[12px] font-bold uppercase text-on-surface-variant">Availability Toggle</h4>
              <CalendarOff className="w-5 h-5 text-outline" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">AK</div>
                  <span className="text-sm">Ahmed K.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">SL</div>
                  <span className="text-sm">Sarah L.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3 opacity-50 italic">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">RM</div>
                  <span className="text-sm">Rahul M.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" />
                  <div className="w-8 h-4 bg-outline-variant rounded-full relative scale-75">
                    <div className="absolute left-1 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">JW</div>
                  <span className="text-sm">Jessica W.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Footer Stats */}
      <footer className="fixed bottom-6 right-8 flex justify-end items-center pointer-events-none z-50">
        <div className="bg-inverse-surface text-on-primary-fixed rounded-full px-6 py-2 shadow-xl pointer-events-auto flex items-center gap-4 border border-outline/30">
          <div className="flex items-center gap-2 pr-4 border-r border-outline/50">
            <span className="text-primary-fixed-dim text-2xl font-bold">128</span>
            <span className="text-[12px] font-bold uppercase text-surface-variant">Leads Assigned (Today)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-secondary-fixed-dim text-2xl font-bold">4.2s</span>
            <span className="text-[12px] font-bold uppercase text-surface-variant">Avg. Routing Time</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
