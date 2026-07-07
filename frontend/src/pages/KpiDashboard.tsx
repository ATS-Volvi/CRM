import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Send, CheckCircle2, Video, MapPin, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, X, Plus } from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";

export default function KpiDashboard() {
  const { token } = useAuth();
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-kpi"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/kpi", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    }
  });

  const [urgentFollowUps, setUrgentFollowUps] = useState([
    {
      id: 1,
      name: "Zahra Farooq",
      desc: `Deal: Enterprise Migration (${formatCurrencyCompact(120000)})`,
      status: "2d Late",
      statusColor: "text-error",
      statusBg: "bg-error-container",
      indicatorColor: "border-error",
      initials: "ZF",
    },
    {
      id: 2,
      name: "David Chen",
      desc: "Pending Signature: Pilot Program",
      status: "4h Left",
      statusColor: "text-on-surface-variant",
      statusBg: "bg-surface-container",
      indicatorColor: "border-outline",
      initials: "DC",
    }
  ]);
  const [activeModal, setActiveModal] = useState<"planWeek" | "dailyReport" | "allTasks" | "calendar" | null>(null);

  const [unplannedTasks, setUnplannedTasks] = useState([
    { id: 't1', title: 'Contract review for Al-Maktoum Group' },
    { id: 't2', title: 'Send pitch deck to Tech-Frontier UAE' },
    { id: 't3', title: 'Follow up on invoice #8892' },
    { id: 't4', title: 'Prepare Q3 performance slides' },
    { id: 't5', title: 'Call new leads from Marketing' }
  ]);
  const [plannedTasks, setPlannedTasks] = useState<{ [key: string]: any[] }>({
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: []
  });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [targetDay, setTargetDay] = useState("unplanned");

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask = { id: 't' + Date.now(), title: newTaskTitle.trim() };
    
    if (targetDay === 'unplanned') {
      setUnplannedTasks(prev => [newTask, ...prev]);
    } else {
      setPlannedTasks(prev => ({
        ...prev,
        [targetDay]: [...prev[targetDay], newTask]
      }));
    }
    setNewTaskTitle("");
  };

  const handleDragStart = (e: any, taskId: string, source: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("source", source);
  };

  const handleDragOver = (e: any) => {
    e.preventDefault(); // necessary to allow dropping
  };

  const handleDrop = (e: any, target: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const source = e.dataTransfer.getData("source");
    if (!taskId || source === target) return;
    
    let taskToMove;
    
    // Remove from source
    if (source === 'unplanned') {
      taskToMove = unplannedTasks.find(t => t.id === taskId);
      setUnplannedTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      taskToMove = plannedTasks[source].find(t => t.id === taskId);
      setPlannedTasks(prev => ({
        ...prev,
        [source]: prev[source].filter(t => t.id !== taskId)
      }));
    }

    if (!taskToMove) return;

    // Add to target
    if (target === 'unplanned') {
      setUnplannedTasks(prev => [...prev, taskToMove]);
    } else {
      setPlannedTasks(prev => ({
        ...prev,
        [target]: [...prev[target], taskToMove]
      }));
    }
  };

  const handleClearUrgent = () => {
    setUrgentFollowUps([]);
  };
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen">
      {/* Welcome Header */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold text-on-surface mb-1">My Today</h1>
          <p className="text-on-surface-variant">Focus for Tuesday, Oct 24, 2023</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveModal("planWeek")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-lg font-bold text-on-surface hover:shadow-md transition-all"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-wider uppercase">Plan Week</span>
          </button>
          <button 
            onClick={() => setActiveModal("dailyReport")}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-wider uppercase">Daily Report</span>
          </button>
        </div>
      </header>

      {/* Top Section: Quick-Action Widgets */}
      <section className="grid grid-cols-12 gap-6 mb-8">
        {/* Tasks Due Today */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" /> Tasks Due Today
            </h3>
            <span className="bg-primary-container text-on-primary-container px-2 py-1 rounded text-[10px] font-bold">5 REMAINING</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-2">
              {isLoading ? (
                <div className="p-2 text-center text-sm text-on-surface-variant animate-pulse">Loading tasks...</div>
              ) : dashboardData?.tasks?.length === 0 ? (
                <div className="p-2 text-center text-sm text-on-surface-variant">No tasks due today.</div>
              ) : (
                dashboardData?.tasks?.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-start gap-4 p-2 hover:bg-surface-bright rounded-lg group">
                    <input type="checkbox" className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 border-outline" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{task.outcome || "Follow-up Task"}</p>
                      <p className="text-[11px] text-on-surface-variant mt-1 font-bold">DUE TODAY</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <button 
            onClick={() => setActiveModal("allTasks")}
            className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-primary hover:bg-primary hover:text-white transition-all uppercase"
          >
            View All Tasks
          </button>
        </div>

        {/* Meetings Today */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" /> Meetings Today
            </h3>
            <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-[10px] font-bold">3 SCHEDULED</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-4">
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">10:30</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">AM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-primary">
                  <p className="text-sm font-bold">Discovery Call: Riyadh Logistics</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    Omar Al-Qahtani
                  </p>
                </div>
              </div>
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">13:00</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">PM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-secondary">
                  <p className="text-sm font-bold">Product Demo: Cloud-Sovereign Solutions</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <Video className="w-3 h-3" /> Zoom Call
                  </p>
                </div>
              </div>
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">15:45</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">PM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-tertiary-container">
                  <p className="text-sm font-bold">Contract Review: Zenith Corp</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> Main Office, Floor 12
                  </p>
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setActiveModal("calendar")}
            className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-secondary hover:bg-secondary hover:text-white transition-all uppercase"
          >
            Go to Calendar
          </button>
        </div>

        {/* Urgent Leads */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-error-container/20">
            <h3 className="font-semibold flex items-center gap-2 text-error">
              <AlertCircle className="w-5 h-5" /> Urgent Follow-ups
            </h3>
            <span className="bg-error text-on-error px-2 py-1 rounded text-[10px] font-bold">4 CRITICAL</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-3">
              {urgentFollowUps.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border-l-4 ${item.indicatorColor}`}>
                  <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs">
                    {item.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                  <span className={`text-[10px] ${item.statusColor} font-bold ${item.statusBg} px-2 py-1 rounded`}>{item.status}</span>
                </div>
              ))}
              {urgentFollowUps.length === 0 && (
                <div className="p-4 text-center text-on-surface-variant text-sm">No urgent follow-ups!</div>
              )}
            </div>
          </div>
          <button 
            onClick={handleClearUrgent}
            className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-error hover:bg-error hover:text-white transition-all uppercase"
          >
            Clear Urgent List
          </button>
        </div>
      </section>

      {/* Middle Section: 'My Performance' KPI Table */}
      <section className="bg-white rounded-xl border border-outline-variant shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-on-surface">My Performance</h2>
            <p className="text-sm text-on-surface-variant mt-1">Real-time KPI tracking vs. target quotas</p>
          </div>
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            <button className="px-4 py-1.5 bg-white rounded shadow-sm text-[10px] font-bold text-primary uppercase">MTD</button>
            <button className="px-4 py-1.5 rounded text-[10px] font-bold text-on-surface-variant uppercase">Q3</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest text-left border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Metric</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Current Month</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Last Month</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Trend</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              <tr className="hover:bg-surface-bright transition-colors">
                <td className="px-6 py-4 text-sm font-bold">Quota Attainment</td>
                <td className="px-6 py-4 text-[13px] font-medium">
                  {dashboardData?.quotaAttainment?.percentage || 0}% 
                  ({formatCurrencyCompact(dashboardData?.quotaAttainment?.current || 0)} / {formatCurrencyCompact(dashboardData?.quotaAttainment?.target || 0)})
                </td>
                <td className="px-6 py-4 text-[13px] font-medium">74%</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1 text-primary font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" /> +8%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[11px] font-bold">
                    ON TRACK
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-bright transition-colors">
                <td className="px-6 py-4 text-sm font-bold">Close Rate</td>
                <td className="px-6 py-4 text-[13px] font-medium">{dashboardData?.closeRate?.current || 0}%</td>
                <td className="px-6 py-4 text-[13px] font-medium">{dashboardData?.closeRate?.previous || 0}%</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1 text-tertiary font-bold text-xs">
                    <ArrowDownRight className="w-4 h-4" /> -2.8%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant px-2 py-1 rounded text-[11px] font-bold">
                    NEEDS FOCUS
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals Overlay */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-outline-variant bg-surface-container-lowest">
              <h2 className="text-xl font-bold text-on-surface">
                {activeModal === "planWeek" && "Weekly Planner"}
                {activeModal === "dailyReport" && "Submit Daily Report"}
                {activeModal === "allTasks" && "All Tasks"}
                {activeModal === "calendar" && "My Calendar"}
              </h2>
              <button 
                onClick={() => setActiveModal(null)} 
                className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {activeModal === "planWeek" && (
                <div className="space-y-6 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-on-surface-variant">Drag tasks from your backlog to balance your week.</p>
                  </div>

                  <div className="flex gap-4">
                    {/* Backlog */}
                    <div 
                      className="w-1/3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col h-[350px]"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'unplanned')}
                    >
                      <h3 className="font-bold text-sm mb-3">Task Backlog</h3>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {unplannedTasks.map(t => (
                          <div 
                            key={t.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, t.id, 'unplanned')}
                            className="p-3 bg-surface border border-outline-variant rounded-lg text-sm shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                          >
                            {t.title}
                          </div>
                        ))}
                        {unplannedTasks.length === 0 && (
                          <p className="text-xs text-on-surface-variant text-center mt-4">No tasks in backlog</p>
                        )}
                      </div>
                    </div>

                    {/* Week Days */}
                    <div className="flex-1 grid grid-cols-5 gap-3 h-[350px]">
                      {["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => (
                        <div 
                          key={day} 
                          className="border border-outline-variant rounded-xl p-2 bg-surface-container-lowest shadow-sm flex flex-col transition-colors hover:bg-surface-container-low/50"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, day)}
                        >
                          <p className="font-bold text-center text-sm mb-2 text-on-surface border-b border-outline-variant pb-2">{day}</p>
                          <div className="flex-1 overflow-y-auto space-y-2 pt-1">
                            {plannedTasks[day].map(t => (
                              <div 
                                key={t.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, t.id, day)}
                                className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium shadow-sm cursor-grab active:cursor-grabbing hover:bg-primary/20 transition-colors line-clamp-3"
                              >
                                {t.title}
                              </div>
                            ))}
                            {plannedTasks[day].length === 0 && (
                              <div className="h-full w-full border-2 border-dashed border-outline-variant/50 rounded-lg flex items-center justify-center text-center">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/40">Drop Here</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-outline-variant mt-4">
                    {/* Add Task UI */}
                    <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-1.5 shadow-sm w-full max-w-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                        <input 
                          type="text" 
                          placeholder="Type new task..." 
                          className="flex-1 bg-transparent px-3 py-1 text-sm outline-none text-on-surface"
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddTask();
                          }}
                        />
                        <select 
                          value={targetDay}
                          onChange={e => setTargetDay(e.target.value)}
                          className="text-sm bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-on-surface-variant cursor-pointer outline-none hover:bg-surface-bright transition-colors"
                        >
                          <option value="unplanned">Backlog</option>
                          <option value="Mon">Mon</option>
                          <option value="Tue">Tue</option>
                          <option value="Wed">Wed</option>
                          <option value="Thu">Thu</option>
                          <option value="Fri">Fri</option>
                        </select>
                        <button 
                          onClick={handleAddTask}
                          disabled={!newTaskTitle.trim()}
                          className="p-2 bg-primary text-white rounded-lg md:hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center"
                          title="Add Task"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:opacity-90 shadow-md transition-all whitespace-nowrap ml-4">Save Weekly Plan</button>
                  </div>
                </div>
              )}

              {activeModal === "dailyReport" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-2">What did you accomplish today?</label>
                    <textarea 
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none shadow-inner" 
                      rows={4}
                      placeholder="e.g., Closed 2 deals, ran 3 product demos..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-2">Any blockers or challenges?</label>
                    <textarea 
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none shadow-inner" 
                      rows={2}
                      placeholder="e.g., Waiting on legal review for Zenith Corp contract..."
                    ></textarea>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 bg-surface-container text-on-surface font-bold rounded-lg hover:bg-surface-container-high transition-colors">Cancel</button>
                    <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 bg-secondary text-white font-bold rounded-lg hover:bg-secondary/90 shadow-md flex items-center gap-2 transition-all">
                      <Send className="w-4 h-4" /> Send Report
                    </button>
                  </div>
                </div>
              )}

              {activeModal === "allTasks" && (
                <div className="space-y-3">
                  {[
                    { id: 1, name: "Contract review for Al-Maktoum Group", meta: "URGENT • Today 11:00 AM" },
                    { id: 2, name: "Send pitch deck to Tech-Frontier UAE", meta: "ROUTINE • Today 02:30 PM" },
                    { id: 3, name: "Follow up on invoice #8892", meta: "FINANCE • Today 04:00 PM" },
                    { id: 4, name: "Prepare Q3 performance slides", meta: "INTERNAL • Tomorrow" },
                    { id: 5, name: "Call new leads from Marketing campaign", meta: "PROSPECTING • Wed" },
                    { id: 6, name: "Sync with pre-sales engineers", meta: "INTERNAL • Thu" },
                  ].map(task => (
                    <div key={task.id} className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:shadow-md transition-all group">
                      <input type="checkbox" className="rounded border-outline-variant text-primary focus:ring-primary w-5 h-5 cursor-pointer" />
                      <div className="flex-1 cursor-pointer">
                        <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{task.name}</p>
                        <p className="text-[11px] text-on-surface-variant font-medium mt-1">{task.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeModal === "calendar" && (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant text-center">
                  <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mb-6">
                    <Calendar className="w-10 h-10" />
                  </div>
                  <h3 className="font-bold text-xl text-on-surface mb-2">Calendar Integration Pending</h3>
                  <p className="text-sm max-w-md mx-auto mb-8">
                    Your calendar view will appear here once you connect your Microsoft Outlook or Google Calendar account in settings.
                  </p>
                  <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 bg-surface-container text-on-surface font-bold rounded-lg hover:bg-surface-container-high transition-colors">
                    Go to Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
