import { Link, useLocation } from "react-router-dom";
import { FileText, Database, Building2, BarChart, UserPlus, Clock, BookOpen } from "lucide-react";

export function MasterDataNav() {
  const location = useLocation();

  const tabs = [
    { name: "Requirements", path: "/master-data/requirements", icon: FileText },
    { name: "Line Items", path: "/master-data/line-items", icon: Database },
    { name: "Construction Items", path: "/master-data/construction-items", icon: Building2 },
    { name: "Pricing Grid", path: "/master-data/pricing", icon: BarChart },
    { name: "Lead Sources", path: "/master-data/lead-sources", icon: UserPlus },
    { name: "KPI Master", path: "/master-data/kpis", icon: Clock },
    { name: "Price Book", path: "/price-book", icon: BookOpen }
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border mb-6 no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.name}
            to={tab.path}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              isActive
                ? "bg-primary text-white shadow-2xs"
                : "bg-surface hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
