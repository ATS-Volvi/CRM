import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Download,
  Table as TableIcon,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  ArrowUpRight,
  Info
} from "lucide-react";

export interface AIChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  type: "bar" | "area" | "line" | "donut" | "pie" | "radar" | "funnel";
  data: any[];
  dataKey: string;
  secondaryKey?: string;
  tertiaryKey?: string;
  categoryKey: string;
  color?: string;
  secondaryColor?: string;
  unit?: string;
  description?: string;
}

export interface AIReportPayload {
  summary: string;
  kpis: Array<{
    label: string;
    value: string;
    delta?: string;
    status?: "positive" | "negative" | "neutral" | "warning";
    subtext?: string;
  }>;
  charts: AIChartConfig[];
  table?: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  };
  recommendations: string[];
  followUps: string[];
}

const PALETTE = [
  "#2563EB", // Primary Blue
  "#10B981", // Emerald
  "#8B5CF6", // Violet
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#14B8A6"  // Teal
];

export function AIReportVisualizer({
  report,
  onFollowUpClick
}: {
  report: AIReportPayload;
  onFollowUpClick?: (question: string) => void;
}) {
  const [selectedChartTypes, setSelectedChartTypes] = useState<Record<string, string>>({});
  const [expandedChart, setExpandedChart] = useState<AIChartConfig | null>(null);

  // Format currency/numbers in tooltips
  const formatValue = (val: any, unit?: string) => {
    if (typeof val !== "number") return val;
    if (unit === "$") {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
      return `$${val.toLocaleString()}`;
    }
    if (unit === "%") return `${val}%`;
    return val.toLocaleString();
  };

  const handleExportCsv = (table: { title: string; headers: string[]; rows: (string | number)[][] }) => {
    const csvContent = [
      table.headers.join(","),
      ...table.rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${table.title.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      
      {/* ─────────────────────────────────────────────────────────────
          1. EXECUTIVE KPI STAT CARDS
         ───────────────────────────────────────────────────────────── */}
      {report.kpis && report.kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {report.kpis.map((kpi, idx) => {
            const isPos = kpi.status === "positive" || (kpi.delta && kpi.delta.startsWith("+"));
            const isNeg = kpi.status === "negative" || (kpi.delta && kpi.delta.startsWith("-"));

            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none" />
                
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  {kpi.delta && (
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isPos
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                          : isNeg
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : null}
                      {kpi.delta}
                    </span>
                  )}
                </div>

                <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {kpi.value}
                </div>

                {kpi.subtext && (
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 truncate">
                    {kpi.subtext}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. EXECUTIVE NARRATIVE SUMMARY
         ───────────────────────────────────────────────────────────── */}
      {report.summary && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
              AI Strategic Takeaways & Synthesis
            </h4>
          </div>

          <div className="prose prose-invert prose-sm max-w-none text-slate-200 text-xs sm:text-sm leading-relaxed space-y-2">
            {report.summary.split("\n\n").map((para, i) => (
              <p key={i} className="leading-relaxed">
                {para.replace(/###\s*/g, "")}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MULTI-GRAPH DYNAMIC RECHARTS GRID
         ───────────────────────────────────────────────────────────── */}
      {report.charts && report.charts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Dynamic Visual Analytics ({report.charts.length} Visualizations)
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Interactive Hover & Legend Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.charts.map((chart, chartIdx) => {
              const currentType = selectedChartTypes[chart.id] || chart.type;
              const primaryColor = chart.color || PALETTE[chartIdx % PALETTE.length];
              const secondaryColor = chart.secondaryColor || PALETTE[(chartIdx + 1) % PALETTE.length];

              return (
                <div
                  key={chart.id || chartIdx}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Chart Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {chart.title}
                      </h4>
                      {chart.subtitle && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {chart.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Chart Type Toggle & Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                      <button
                        onClick={() => setSelectedChartTypes(prev => ({ ...prev, [chart.id]: "bar" }))}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          currentType === "bar" ? "bg-white dark:bg-slate-700 text-primary font-bold shadow-xs" : "text-slate-400 hover:text-slate-600"
                        }`}
                        title="Bar Chart"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedChartTypes(prev => ({ ...prev, [chart.id]: "area" }))}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          currentType === "area" || currentType === "line" ? "bg-white dark:bg-slate-700 text-primary font-bold shadow-xs" : "text-slate-400 hover:text-slate-600"
                        }`}
                        title="Area / Line Trend"
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedChartTypes(prev => ({ ...prev, [chart.id]: "donut" }))}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          currentType === "donut" || currentType === "pie" ? "bg-white dark:bg-slate-700 text-primary font-bold shadow-xs" : "text-slate-400 hover:text-slate-600"
                        }`}
                        title="Donut / Distribution"
                      >
                        <PieIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Recharts Canvas */}
                  <div className="w-full h-64 my-1">
                    <ResponsiveContainer width="100%" height="100%">
                      {currentType === "donut" || currentType === "pie" ? (
                        <PieChart>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0];
                                return (
                                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-800">
                                    <div className="font-bold">{data.name}</div>
                                    <div className="text-indigo-300 font-extrabold mt-0.5">
                                      {formatValue(data.value, chart.unit)}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                          />
                          <Pie
                            data={chart.data}
                            dataKey={chart.dataKey}
                            nameKey={chart.categoryKey || "name"}
                            cx="50%"
                            cy="50%"
                            innerRadius={currentType === "donut" ? 50 : 0}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {chart.data.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      ) : currentType === "line" ? (
                        <LineChart data={chart.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                          <XAxis 
                            dataKey={chart.categoryKey || "name"} 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatValue(v, chart.unit)}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-xl border border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-300">{label}</div>
                                    {payload.map((entry, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span className="text-slate-400 capitalize">{entry.name}:</span>
                                        <span className="font-extrabold text-white">
                                          {formatValue(entry.value, chart.unit)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Line
                            type="monotone"
                            dataKey={chart.dataKey}
                            name={chart.dataKey.replace(/([A-Z])/g, ' $1')}
                            stroke={primaryColor}
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: primaryColor }}
                          />
                          {chart.secondaryKey && (
                            <Line
                              type="monotone"
                              dataKey={chart.secondaryKey}
                              name={chart.secondaryKey.replace(/([A-Z])/g, ' $1')}
                              stroke={secondaryColor}
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={{ r: 3, fill: secondaryColor }}
                            />
                          )}
                        </LineChart>
                      ) : currentType === "area" ? (
                        <AreaChart data={chart.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                            </linearGradient>
                            {chart.secondaryKey && (
                              <linearGradient id={`grad-sec-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.0} />
                              </linearGradient>
                            )}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                          <XAxis 
                            dataKey={chart.categoryKey || "name"} 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatValue(v, chart.unit)}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-xl border border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-300">{label}</div>
                                    {payload.map((entry, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span className="text-slate-400 capitalize">{entry.name}:</span>
                                        <span className="font-extrabold text-white">
                                          {formatValue(entry.value, chart.unit)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Area
                            type="monotone"
                            dataKey={chart.dataKey}
                            name={chart.dataKey.replace(/([A-Z])/g, ' $1')}
                            stroke={primaryColor}
                            strokeWidth={2.5}
                            fill={`url(#grad-${chart.id})`}
                          />
                          {chart.secondaryKey && (
                            <Area
                              type="monotone"
                              dataKey={chart.secondaryKey}
                              name={chart.secondaryKey.replace(/([A-Z])/g, ' $1')}
                              stroke={secondaryColor}
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              fill={`url(#grad-sec-${chart.id})`}
                            />
                          )}
                        </AreaChart>
                      ) : (
                        <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                          <XAxis 
                            dataKey={chart.categoryKey || "name"} 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: "#94a3b8" }} 
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatValue(v, chart.unit)}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-xl border border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-300">{label}</div>
                                    {payload.map((entry, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span className="text-slate-400 capitalize">{entry.name}:</span>
                                        <span className="font-extrabold text-white">
                                          {formatValue(entry.value, chart.unit)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Bar
                            dataKey={chart.dataKey}
                            name={chart.dataKey.replace(/([A-Z])/g, ' $1')}
                            fill={primaryColor}
                            radius={[6, 6, 0, 0]}
                          />
                          {chart.secondaryKey && (
                            <Bar
                              dataKey={chart.secondaryKey}
                              name={chart.secondaryKey.replace(/([A-Z])/g, ' $1')}
                              fill={secondaryColor}
                              radius={[6, 6, 0, 0]}
                            />
                          )}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Chart Footnote / Insight */}
                  {chart.description && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{chart.description}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. STRUCTURED DATA BREAKDOWN TABLE
         ───────────────────────────────────────────────────────────── */}
      {report.table && report.table.headers && report.table.headers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-indigo-600" />
              {report.table.title || "Detailed Segment Data"}
            </h4>
            <button
              onClick={() => handleExportCsv(report.table!)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  {report.table.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-extrabold uppercase tracking-wider text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {report.table.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className={`px-4 py-3 ${cIdx === 0 ? "font-bold text-slate-900 dark:text-white" : ""}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. ACTIONABLE STRATEGIC RECOMMENDATIONS
         ───────────────────────────────────────────────────────────── */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-5">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            AI Prescribed Action Items
          </h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. CONTEXTUAL FOLLOW-UP QUESTION CHIPS
         ───────────────────────────────────────────────────────────── */}
      {report.followUps && report.followUps.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Suggested Deep-Dive Questions:
          </span>
          <div className="flex flex-wrap gap-2">
            {report.followUps.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUpClick && onFollowUpClick(q)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary text-slate-700 dark:text-slate-200 text-xs font-semibold hover:text-primary transition-all shadow-2xs group cursor-pointer"
              >
                <span>{q}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
