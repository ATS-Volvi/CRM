import { LayoutGrid, Layers, Sparkles, SlidersHorizontal } from "lucide-react";

export type DashboardTheme = "minimalist" | "bento" | "pastel";

interface Props {
  currentTheme: DashboardTheme;
  onThemeChange: (theme: DashboardTheme) => void;
  onOpenCustomizer?: () => void;
}

export function DashboardThemeSelector({ currentTheme, onThemeChange, onOpenCustomizer }: Props) {
  return (
    <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-2 shadow-xs mb-6 flex-wrap gap-2">
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
        <button
          onClick={() => onThemeChange("minimalist")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentTheme === "minimalist"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Minimalist Slate</span>
        </button>

        <button
          onClick={() => onThemeChange("bento")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentTheme === "bento"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Bento Grid</span>
        </button>

        <button
          onClick={() => onThemeChange("pastel")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentTheme === "pastel"
              ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pastel Glass</span>
        </button>
      </div>

      {onOpenCustomizer && (
        <button
          onClick={onOpenCustomizer}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-all"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
          <span>Customize Widgets</span>
        </button>
      )}
    </div>
  );
}
