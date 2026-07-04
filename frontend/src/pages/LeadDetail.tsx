import { User } from "lucide-react";
export default function LeadDetail() {
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-3xl font-bold">Lead Details</h1><p className="text-on-surface-variant">Comprehensive view</p></div>
      </div>
      <div className="bg-white rounded-xl border border-outline-variant p-16 text-center text-on-surface-variant">
        <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p>Lead Detail module loaded.</p>
      </div>
    </div>
  );
}
