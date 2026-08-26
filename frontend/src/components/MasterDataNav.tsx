import { Link, useLocation } from "react-router-dom";
import {
  Package, Tag, Ruler, BookOpen, FileText, CreditCard, Truck, ShieldCheck,
  LayoutTemplate, UserPlus, GitBranch, Globe, Target, Settings, ChevronRight, MessageSquare
} from "lucide-react";

interface NavGroup {
  label: string;
  items: { name: string; path: string; icon: React.ElementType; badge?: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Commercial Catalog",
    items: [
      { name: "Line Item Catalog", path: "/master-data/catalog", icon: Package, badge: "Primary" },
      { name: "Categories", path: "/master-data/categories", icon: Tag },
      { name: "Units of Measure", path: "/master-data/uoms", icon: Ruler },
      { name: "Price Lists", path: "/price-book", icon: BookOpen },
    ],
  },
  {
    label: "Quotation Config",
    items: [
      { name: "Quotation Templates", path: "/master-data/quote-templates", icon: LayoutTemplate },
      { name: "Payment Terms", path: "/master-data/payment-terms", icon: CreditCard },
      { name: "Delivery Terms", path: "/master-data/delivery-terms", icon: Truck },
      { name: "Warranty Terms", path: "/master-data/warranty-terms", icon: ShieldCheck },
      { name: "Discount Rules", path: "/master-data/discount-rules", icon: FileText },
    ],
  },
  {
    label: "Sales Config",
    items: [
      { name: "Lead Sources", path: "/master-data/lead-sources", icon: UserPlus },
      { name: "Pipeline Stages", path: "/master-data/pipeline-stages", icon: GitBranch },
      { name: "Industries", path: "/master-data/industries", icon: Globe },
    ],
  },
  {
    label: "Performance",
    items: [
      { name: "KPI Master", path: "/master-data/kpis", icon: Target },
    ],
  },
  {
    label: "Communications",
    items: [
      { name: "Message Templates", path: "/master-data/message-templates", icon: MessageSquare, badge: "WhatsApp" },
    ],
  },
  {
    label: "Service Architecture & BOM",
    items: [
      { name: "Service Types", path: "/master-data/requirements", icon: Settings },
      { name: "Service Items", path: "/master-data/line-items", icon: Settings },
      { name: "Construction Items", path: "/master-data/construction-items", icon: Settings },
      { name: "Pricing Grid", path: "/master-data/pricing", icon: Settings },
    ],
  },
];

export function MasterDataSidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-5 pr-2">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Master Data</p>
      </div>
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-2">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.badge && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 text-white/70" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

// Also keep the old top-tab nav for backward compat (used by BOM pages)
export function MasterDataNav() {
  const location = useLocation();
  const compactTabs = [
    { name: "Service Types", path: "/master-data/requirements" },
    { name: "Service Items", path: "/master-data/line-items" },
    { name: "Construction", path: "/master-data/construction-items" },
    { name: "Pricing Grid", path: "/master-data/pricing" },
    { name: "Templates", path: "/master-data/quote-templates" },
    { name: "Lead Sources", path: "/master-data/lead-sources" },
    { name: "KPI Master", path: "/master-data/kpis" },
    { name: "Price Lists", path: "/price-book" },
    { name: "Msg Templates", path: "/master-data/message-templates" },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border mb-6 no-scrollbar">
      {compactTabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.name}
            to={tab.path}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              isActive
                ? "bg-primary text-white shadow-2xs"
                : "bg-surface hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
