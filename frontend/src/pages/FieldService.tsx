import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  CalendarCheck,
  ChevronRight,
  MapPin,
  DollarSign,
  Tag,
  Trash2
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface AccountSummary {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  industry?: string;
  primaryContactName?: string;
  contacts?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
  }>;
}

interface WorkOrderLineItem {
  id: string;
  lineItemNumber?: string;
  description?: string;
  status: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ServiceAppointment {
  id: string;
  appointmentNumber?: string;
  subject?: string;
  status: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  earliestStartTime?: string;
  dueDate?: string;
  city?: string;
  state?: string;
  serviceResource?: {
    id: string;
    name: string;
    resourceType?: string;
  };
}

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  subject: string;
  description?: string;
  status: "New" | "In Progress" | "On Hold" | "Completed" | "Cannot Complete" | "Closed" | "Canceled" | string;
  priority: "Low" | "Medium" | "High" | "Critical" | string;
  accountId?: string;
  account?: AccountSummary;
  contact?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  owner?: {
    id: string;
    name?: string;
    email?: string;
  };
  startDate?: string;
  endDate?: string;
  duration?: number;
  durationInHours?: number;
  subtotal?: number;
  grandTotal?: number;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lineItems?: WorkOrderLineItem[];
  serviceAppointments?: ServiceAppointment[];
  createdAt: string;
}

const STATUS_PILLS: Record<string, string> = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "On Hold": "bg-purple-50 text-purple-700 border-purple-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Cannot Complete": "bg-rose-50 text-rose-700 border-rose-200",
  Closed: "bg-slate-100 text-slate-700 border-slate-300",
  Canceled: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_BADGES: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200 font-semibold",
  High: "bg-orange-50 text-orange-700 border-orange-200 font-semibold",
  Medium: "bg-blue-50 text-blue-700 border-blue-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function FieldService() {
  const queryClient = useQueryClient();

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Modals & Drawers
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isLineItemModalOpen, setIsLineItemModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // New Work Order Form State
  const [formData, setFormData] = useState({
    subject: "",
    priority: "Medium",
    status: "New",
    accountId: "",
    contactId: "",
    description: "",
    startDate: "",
    endDate: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
  });

  // New Line Item Form State
  const [lineItemFormData, setLineItemFormData] = useState({
    description: "",
    quantity: 1,
    unitPrice: 0,
    status: "New",
  });

  // New Appointment Form State
  const [appointmentFormData, setAppointmentFormData] = useState({
    subject: "",
    status: "New",
    scheduledStartTime: "",
    scheduledEndTime: "",
    dueDate: "",
    description: "",
  });

  const showToast = (type: "ok" | "err", msg: string) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Accounts for dropdown
  const { data: accountsData } = useQuery({
    queryKey: ["accounts-lookup"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/v1/accounts");
      return Array.isArray(res) ? res : [];
    },
  });

  const accounts: AccountSummary[] = accountsData || [];

  // Fetch Work Orders
  const { data: workOrdersData, isLoading } = useQuery({
    queryKey: ["work-orders", statusFilter, priorityFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await apiClient.get<WorkOrder[]>(`/api/v1/work-orders?${params.toString()}`);
      return Array.isArray(res) ? res : [];
    },
  });

  const workOrders: WorkOrder[] = workOrdersData || [];

  // Fetch detailed work order when drawer is open
  const { data: activeWorkOrder, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["work-order-detail", selectedWorkOrderId],
    queryFn: async () => {
      if (!selectedWorkOrderId) return null;
      const res = await apiClient.get<WorkOrder>(`/api/v1/work-orders/${selectedWorkOrderId}`);
      return res;
    },
    enabled: !!selectedWorkOrderId,
  });

  // Create Work Order Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post("/api/v1/work-orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setIsCreateModalOpen(false);
      setFormData({
        subject: "",
        priority: "Medium",
        status: "New",
        accountId: "",
        contactId: "",
        description: "",
        startDate: "",
        endDate: "",
        street: "",
        city: "",
        state: "",
        postalCode: "",
      });
      showToast("ok", "Work order created successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to create work order.");
    },
  });

  // Quick Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiClient.put(`/api/v1/work-orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Work order status updated.");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to update status.");
    },
  });

  // Schedule Appointment Mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedWorkOrderId) throw new Error("No work order selected");
      return apiClient.post(`/api/v1/work-orders/${selectedWorkOrderId}/appointments`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      setIsAppointmentModalOpen(false);
      setAppointmentFormData({
        subject: "",
        status: "New",
        scheduledStartTime: "",
        scheduledEndTime: "",
        dueDate: "",
        description: "",
      });
      showToast("ok", "Appointment scheduled successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to schedule appointment.");
    },
  });

  // Add Line Item Mutation
  const addLineItemMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedWorkOrderId) throw new Error("No work order selected");
      return apiClient.post(`/api/v1/work-orders/${selectedWorkOrderId}/line-items`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      setIsLineItemModalOpen(false);
      setLineItemFormData({
        description: "",
        quantity: 1,
        unitPrice: 0,
        status: "New",
      });
      showToast("ok", "Line item added successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to add line item.");
    },
  });

  // Delete Line Item Mutation
  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      if (!selectedWorkOrderId) throw new Error("No work order selected");
      return apiClient.delete(`/api/v1/work-orders/${selectedWorkOrderId}/line-items/${lineItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Line item removed.");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to delete line item.");
    },
  });

  // Filter contacts for selected account
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === formData.accountId);
  }, [accounts, formData.accountId]);

  const availableContacts = useMemo(() => {
    if (selectedAccount?.contacts && selectedAccount.contacts.length > 0) {
      return selectedAccount.contacts;
    }
    return accounts.flatMap((a) => a.contacts || []);
  }, [selectedAccount, accounts]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      showToast("err", "Subject is required.");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleAppointmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAppointmentMutation.mutate(appointmentFormData);
  };

  // Metrics summary
  const totalCount = workOrders.length;
  const inProgressCount = workOrders.filter((w) => w.status === "In Progress").length;
  const completedCount = workOrders.filter((w) => w.status === "Completed").length;
  const criticalCount = workOrders.filter((w) => w.priority === "Critical" || w.priority === "High").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold animate-fade-in ${
            toastMessage.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-red-50 text-red-800 border-red-300"
          }`}
        >
          {toastMessage.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{toastMessage.msg}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Field Service & Work Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage dispatch, on-site service appointments, work order line items, and maintenance schedules.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="enterprise-btn-primary"
        >
          <Plus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Work Orders
          </div>
          <div className="text-xl font-extrabold text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-500">All registered job requests</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Active / In Progress
          </div>
          <div className="text-xl font-extrabold text-amber-600">{inProgressCount}</div>
          <div className="text-[11px] text-slate-500">Currently dispatched or underway</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Critical / High Priority
          </div>
          <div className="text-xl font-extrabold text-red-600">{criticalCount}</div>
          <div className="text-[11px] text-slate-500">Urgent service requirements</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Completed Orders
          </div>
          <div className="text-xl font-extrabold text-emerald-600">{completedCount}</div>
          <div className="text-[11px] text-slate-500">Successfully finalized jobs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="enterprise-card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search work order #, subject, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="enterprise-input pl-9 w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="enterprise-input py-1.5 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cannot Complete">Cannot Complete</option>
              <option value="Closed">Closed</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="enterprise-input py-1.5 text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {(statusFilter !== "ALL" || priorityFilter !== "ALL" || search) && (
            <button
              onClick={() => {
                setStatusFilter("ALL");
                setPriorityFilter("ALL");
                setSearch("");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="enterprise-card overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Work Order</th>
              <th>Subject</th>
              <th>Account</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due / End Date</th>
              <th>Total</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading work orders...</span>
                  </div>
                </td>
              </tr>
            ) : workOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Wrench className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-700 text-sm">No work orders found</p>
                    <p className="text-xs text-slate-400">
                      Create your first work order to track field dispatches and service appointments.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="enterprise-btn-primary mx-auto mt-2 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Work Order
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              workOrders.map((wo) => {
                const statusStyle =
                  STATUS_PILLS[wo.status] || "bg-slate-100 text-slate-700 border-slate-200";
                const priorityStyle =
                  PRIORITY_BADGES[wo.priority] || "bg-slate-100 text-slate-600 border-slate-200";

                return (
                  <tr
                    key={wo.id}
                    onClick={() => setSelectedWorkOrderId(wo.id)}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                  >
                    <td>
                      <div className="font-mono font-bold text-xs text-blue-600">
                        {wo.workOrderNumber || `WO-${wo.id.slice(0, 5)}`}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(wo.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900 text-xs">{wo.subject}</div>
                      {wo.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {wo.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {wo.account ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{wo.account.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`enterprise-badge ${statusStyle}`}>
                        {wo.status}
                      </span>
                    </td>
                    <td>
                      <span className={`enterprise-badge ${priorityStyle}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600">
                      {wo.endDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(wo.endDate).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-xs font-semibold text-slate-800">
                      {wo.grandTotal ? `₹${Number(wo.grandTotal).toLocaleString()}` : "₹0"}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWorkOrderId(wo.id);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        title="View details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL DRAWER */}
      {selectedWorkOrderId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-fade-in">
          <div
            className="w-full max-w-2xl bg-white border-l border-slate-200 h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-xs">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 font-mono">
                        {activeWorkOrder?.workOrderNumber || "Work Order Details"}
                      </h2>
                      {activeWorkOrder && (
                        <span
                          className={`enterprise-badge ${
                            STATUS_PILLS[activeWorkOrder.status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {activeWorkOrder.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeWorkOrder?.subject}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedWorkOrderId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              {isLoadingDetail ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading details...
                </div>
              ) : activeWorkOrder ? (
                <div className="p-6 space-y-6">
                  {/* Quick Action / Status Transition */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-xs font-semibold text-slate-700">Update Status:</span>
                    <div className="flex items-center gap-1.5">
                      {["In Progress", "Completed", "Closed"].map((s) => (
                        <button
                          key={s}
                          onClick={() =>
                            updateStatusMutation.mutate({ id: activeWorkOrder.id, status: s })
                          }
                          disabled={activeWorkOrder.status === s}
                          className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                            activeWorkOrder.status === s
                              ? "bg-slate-200 text-slate-400 border-slate-300 cursor-default"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" /> Account
                      </div>
                      <div className="font-semibold text-slate-800">
                        {activeWorkOrder.account?.name || "Unassigned"}
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-500" /> Priority
                      </div>
                      <div>
                        <span
                          className={`enterprise-badge ${
                            PRIORITY_BADGES[activeWorkOrder.priority] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {activeWorkOrder.priority}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" /> Start Date
                      </div>
                      <div className="font-semibold text-slate-800">
                        {activeWorkOrder.startDate
                          ? new Date(activeWorkOrder.startDate).toLocaleString()
                          : "Not scheduled"}
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="text-slate-400 font-medium flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-slate-500" /> Due / End Date
                      </div>
                      <div className="font-semibold text-slate-800">
                        {activeWorkOrder.endDate
                          ? new Date(activeWorkOrder.endDate).toLocaleString()
                          : "Open"}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {activeWorkOrder.description && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Description & Instructions
                      </h4>
                      <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200/80 leading-relaxed">
                        {activeWorkOrder.description}
                      </div>
                    </div>
                  )}

                  {/* Location Address */}
                  {(activeWorkOrder.street || activeWorkOrder.city) && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-start gap-2 text-xs">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Service Location: </span>
                        <span className="text-slate-600">
                          {[
                            activeWorkOrder.street,
                            activeWorkOrder.city,
                            activeWorkOrder.state,
                            activeWorkOrder.postalCode,
                            activeWorkOrder.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* SECTION 1: WORK ORDER LINE ITEMS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" /> Line Items (
                        {activeWorkOrder.lineItems?.length || 0})
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-slate-800">
                          Total: ₹{Number(activeWorkOrder.grandTotal || 0).toLocaleString()}
                        </div>
                        <button
                          onClick={() => setIsLineItemModalOpen(true)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Line Item
                        </button>
                      </div>
                    </div>

                    {activeWorkOrder.lineItems && activeWorkOrder.lineItems.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="enterprise-table">
                          <thead>
                            <tr>
                              <th>Item #</th>
                              <th>Description</th>
                              <th className="text-right">Qty</th>
                              <th className="text-right">Unit Price</th>
                              <th className="text-right">Total</th>
                              <th className="text-center w-10">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeWorkOrder.lineItems.map((li) => (
                              <tr key={li.id}>
                                <td className="font-mono text-xs">{li.lineItemNumber || "—"}</td>
                                <td className="text-xs font-medium text-slate-800">
                                  {li.description || "Service item"}
                                </td>
                                <td className="text-right text-xs">{li.quantity}</td>
                                <td className="text-right text-xs">
                                  ₹{Number(li.unitPrice).toLocaleString()}
                                </td>
                                <td className="text-right text-xs font-bold text-slate-900">
                                  ₹{Number(li.totalPrice).toLocaleString()}
                                </td>
                                <td className="text-center text-xs">
                                  <button
                                    onClick={() => deleteLineItemMutation.mutate(li.id)}
                                    title="Delete line item"
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400 border border-slate-200/80 flex flex-col items-center justify-center gap-2">
                        <span>No line items recorded for this work order.</span>
                        <button
                          onClick={() => setIsLineItemModalOpen(true)}
                          className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add First Line Item
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: SERVICE APPOINTMENTS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarCheck className="w-4 h-4 text-blue-600" /> Scheduled Appointments (
                        {activeWorkOrder.serviceAppointments?.length || 0})
                      </h3>
                      <button
                        onClick={() => setIsAppointmentModalOpen(true)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Schedule Appointment
                      </button>
                    </div>

                    {activeWorkOrder.serviceAppointments &&
                    activeWorkOrder.serviceAppointments.length > 0 ? (
                      <div className="space-y-2">
                        {activeWorkOrder.serviceAppointments.map((sa) => (
                          <div
                            key={sa.id}
                            className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-blue-600">
                                  {sa.appointmentNumber || `SA-${sa.id.slice(0, 5)}`}
                                </span>
                                <span className="text-xs font-semibold text-slate-800">
                                  {sa.subject || "Appointment"}
                                </span>
                              </div>
                              <span className="enterprise-badge bg-blue-50 text-blue-700 border-blue-200">
                                {sa.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                              {sa.scheduledStartTime && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {new Date(sa.scheduledStartTime).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              )}
                              {sa.serviceResource && (
                                <div className="flex items-center gap-1 font-medium text-slate-700">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{sa.serviceResource.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400 border border-slate-200/80">
                        No service appointments scheduled yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedWorkOrderId(null)}
                className="enterprise-btn-secondary text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WORK ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" /> Create Work Order
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. On-site Generator Maintenance"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="enterprise-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Account (Company / Organization)
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => {
                      const accId = e.target.value;
                      setFormData({ ...formData, accountId: accId, contactId: "" });
                    }}
                    className="enterprise-input w-full"
                  >
                    <option value="">Select Account (Optional)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.industry ? `(${a.industry})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contact Person
                  </label>
                  <select
                    value={formData.contactId}
                    onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                    className="enterprise-input w-full"
                  >
                    <option value="">Select Contact (Optional)</option>
                    {availableContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} {c.role ? `— ${c.role}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="enterprise-input w-full"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="enterprise-input w-full"
                  >
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="enterprise-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Due / End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Details regarding service requirements or diagnostic notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="enterprise-input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    placeholder="123 Industrial Park"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Bangalore"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="enterprise-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  {createMutation.isPending ? "Creating..." : "Save Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE APPOINTMENT MODAL */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" /> Schedule Service Appointment
              </h3>
              <button
                onClick={() => setIsAppointmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAppointmentSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Appointment Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Field Inspection & Part Replacement"
                  value={appointmentFormData.subject}
                  onChange={(e) =>
                    setAppointmentFormData({ ...appointmentFormData, subject: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={appointmentFormData.scheduledStartTime}
                    onChange={(e) =>
                      setAppointmentFormData({
                        ...appointmentFormData,
                        scheduledStartTime: e.target.value,
                      })
                    }
                    className="enterprise-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={appointmentFormData.scheduledEndTime}
                    onChange={(e) =>
                      setAppointmentFormData({
                        ...appointmentFormData,
                        scheduledEndTime: e.target.value,
                      })
                    }
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions for the technician..."
                  value={appointmentFormData.description}
                  onChange={(e) =>
                    setAppointmentFormData({
                      ...appointmentFormData,
                      description: e.target.value,
                    })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAppointmentModalOpen(false)}
                  className="enterprise-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAppointmentMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  {createAppointmentMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LINE ITEM MODAL */}
      {isLineItemModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" /> Add Work Order Line Item
              </h3>
              <button
                onClick={() => setIsLineItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!lineItemFormData.description.trim()) {
                  showToast("err", "Description is required.");
                  return;
                }
                addLineItemMutation.mutate(lineItemFormData);
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diagnostic & Repair Service"
                  value={lineItemFormData.description}
                  onChange={(e) =>
                    setLineItemFormData({ ...lineItemFormData, description: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={lineItemFormData.quantity}
                    onChange={(e) =>
                      setLineItemFormData({
                        ...lineItemFormData,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="enterprise-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={lineItemFormData.unitPrice}
                    onChange={(e) =>
                      setLineItemFormData({
                        ...lineItemFormData,
                        unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={lineItemFormData.status}
                  onChange={(e) =>
                    setLineItemFormData({ ...lineItemFormData, status: e.target.value })
                  }
                  className="enterprise-input w-full"
                >
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 flex justify-between font-semibold">
                <span>Calculated Item Total:</span>
                <span className="text-slate-900 font-bold">
                  ₹{(lineItemFormData.quantity * lineItemFormData.unitPrice).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLineItemModalOpen(false)}
                  className="enterprise-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLineItemMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  {addLineItemMutation.isPending ? "Adding..." : "Add Line Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
