import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Inbox, Building2, Calendar, CheckSquare, FileText,
  Target, PhoneCall, Receipt, X
} from "lucide-react";

export function QuickActionFab() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { label: "New Lead", icon: Inbox, color: "bg-indigo-600 hover:bg-indigo-700 text-white", path: "/leads/new" },
    { label: "New Customer", icon: Building2, color: "bg-emerald-600 hover:bg-emerald-700 text-white", path: "/customers" },
    { label: "Schedule Meeting", icon: Calendar, color: "bg-blue-600 hover:bg-blue-700 text-white", path: "/home" },
    { label: "New Task", icon: CheckSquare, color: "bg-amber-600 hover:bg-amber-700 text-white", path: "/home" },
    { label: "Generate Quote", icon: FileText, color: "bg-violet-600 hover:bg-violet-700 text-white", path: "/quotes/new" },
    { label: "New Deal", icon: Target, color: "bg-pink-600 hover:bg-pink-700 text-white", path: "/pipeline" },
    { label: "Log Call", icon: PhoneCall, color: "bg-teal-600 hover:bg-teal-700 text-white", path: "/home" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 space-y-2 animate-slide-up flex flex-col items-end">
          {actions.map(act => {
            const Icon = act.icon;
            return (
              <button
                key={act.label}
                onClick={() => {
                  setIsOpen(false);
                  navigate(act.path);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all hover:scale-105 ${act.color}`}
              >
                <Icon className="w-4 h-4" />
                {act.label}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
        title="Quick Create (Actions)"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}
