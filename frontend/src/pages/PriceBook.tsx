import { Book, Plus } from "lucide-react";
export default function PriceBook() {
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-3xl font-bold">Price Book</h1><p className="text-on-surface-variant">Product catalog and pricing</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold"><Plus className="w-5 h-5"/> Add Product</button>
      </div>
      <div className="bg-white rounded-xl border border-outline-variant p-16 text-center text-on-surface-variant">
        <Book className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p>Price Book module loaded.</p>
      </div>
    </div>
  );
}
