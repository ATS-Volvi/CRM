import { History } from "lucide-react";
export default function QuoteHistory() {
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-3xl font-bold">Quote History</h1><p className="text-on-surface-variant">Past versions</p></div>
      </div>
      <div className="bg-white rounded-xl border border-outline-variant p-16 text-center text-on-surface-variant">
        <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p>Quote History module loaded.</p>
      </div>
    </div>
  );
}
