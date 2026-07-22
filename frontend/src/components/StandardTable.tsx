import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Search, Filter, Calendar, Download, Plus, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Edit, Trash2
} from "lucide-react";

interface Column {
  key: string;
  header: string;
  render?: (item: any) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface StandardTableProps {
  title?: string;
  description?: string;
  columns: Column[];
  data: any[];
  isLoading?: boolean;
  onAddClick?: () => void;
  addLabel?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  statusFilter?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: { value: string; label: string }[];
  ownerFilter?: string;
  onOwnerChange?: (val: string) => void;
  ownerOptions?: { value: string; label: string }[];
  onExport?: () => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
}

export function StandardTable({
  title,
  description,
  columns,
  data,
  isLoading,
  onAddClick,
  addLabel = "+ Add Item",
  searchQuery = "",
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions = [],
  ownerFilter,
  onOwnerChange,
  ownerOptions = [],
  onExport,
  page = 1,
  totalPages = 1,
  onPageChange
}: StandardTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map(d => d.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* FILTER & ACTION TOOLBAR */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search records..." 
            className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {statusOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Status:</span>
              <select 
                value={statusFilter}
                onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
                className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {ownerOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Owner:</span>
              <select 
                value={ownerFilter}
                onChange={(e) => onOwnerChange && onOwnerChange(e.target.value)}
                className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Owners</option>
                {ownerOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {onExport && (
            <button 
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg border border-border transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}

          {onAddClick && (
            <button 
              onClick={onAddClick}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all active:scale-95 ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{addLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* STANDARDIZED DATA TABLE */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                {columns.map(col => (
                  <th 
                    key={col.key} 
                    className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-muted-foreground font-semibold animate-pulse">
                    Loading records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-6 py-16 text-center text-muted-foreground space-y-2">
                    <p className="font-bold">No records found</p>
                    <p className="text-[11px]">Try adjusting your search query or filters.</p>
                  </td>
                </tr>
              ) : (
                data.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      {columns.map(col => (
                        <td 
                          key={col.key} 
                          className={`px-4 py-3 font-semibold ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                        >
                          {col.render ? col.render(item) : item[col.key] || "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <button className="p-1 hover:text-primary rounded">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex justify-between items-center text-xs font-semibold text-muted-foreground">
          <span>Showing {data.length} records</span>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button 
              disabled={page >= totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
