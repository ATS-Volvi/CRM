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
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  CalendarCheck,
  ChevronRight,
  MapPin,
  DollarSign,
  Tag,
  Trash2,
  Phone,
  PhoneCall,
  LogIn,
  LogOut,
  Edit2
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
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  actualDuration?: number | null;
  serviceResource?: {
    id: string;
    name: string;
    resourceType?: string;
  };
}

interface ServiceResourceItem {
  id: string;
  name: string;
  resourceType: string;
  userId?: string | null;
  description?: string | null;
  isActive: boolean;
  location?: string | null;
  territory?: string | null;
  skills?: string[];
  email?: string | null;
  phone?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  createdAt?: string;
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
  primaryPhone?: string | null;
  phoneSource?: string | null;
  alternatePhone?: string | null;
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
    serviceResourceId: "",
  });

  // Active Tab: "work-orders" | "service-resources"
  const [activeTab, setActiveTab] = useState<"work-orders" | "service-resources">("work-orders");

  // Service Resource Management States
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceTerritoryFilter, setResourceTerritoryFilter] = useState("ALL");
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isEditResourceModalOpen, setIsEditResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ServiceResourceItem | null>(null);
  const [resourceFormData, setResourceFormData] = useState({
    userId: "",
    territory: "",
    skills: "",
    resourceType: "Technician",
    isActive: true,
    description: "",
  });

  const showToast = (type: "ok" | "err", msg: string) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Service Resources
  const { data: serviceResourcesData } = useQuery({
    queryKey: ["service-resources"],
    queryFn: async () => {
      const res = await apiClient.get<ServiceResourceItem[]>("/api/v1/service-resources");
      return Array.isArray(res) ? res : [];
    },
  });
  const serviceResources: ServiceResourceItem[] = serviceResourcesData || [];

  // Fetch Available Users for Service Resource Creation
  const { data: availableUsersData } = useQuery({
    queryKey: ["service-resources-available-users"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/v1/service-resources/available-users");
      return Array.isArray(res) ? res : [];
    },
    enabled: isResourceModalOpen,
  });
  const availableUsers: any[] = availableUsersData || [];

  // Create Service Resource Mutation
  const createServiceResourceMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post("/api/v1/service-resources", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-resources"] });
      queryClient.invalidateQueries({ queryKey: ["service-resources-available-users"] });
      setIsResourceModalOpen(false);
      setResourceFormData({
        userId: "",
        territory: "",
        skills: "",
        resourceType: "Technician",
        isActive: true,
        description: "",
      });
      showToast("ok", "Service resource created successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to create service resource.");
    },
  });

  // Update Service Resource Mutation
  const updateServiceResourceMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return apiClient.put(`/api/v1/service-resources/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-resources"] });
      setIsEditResourceModalOpen(false);
      setEditingResource(null);
      showToast("ok", "Service resource updated successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to update service resource.");
    },
  });

  // Check-In Appointment Mutation
  const checkInAppointmentMutation = useMutation({
    mutationFn: async ({
      workOrderId,
      appointmentId,
    }: {
      workOrderId: string;
      appointmentId: string;
    }) => {
      return apiClient.put(`/api/v1/work-orders/${workOrderId}/appointments/${appointmentId}`, {
        action: "check-in",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Technician checked in successfully!");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to check in.");
    },
  });

  // Check-Out Appointment Mutation
  const checkOutAppointmentMutation = useMutation({
    mutationFn: async ({
      workOrderId,
      appointmentId,
    }: {
      workOrderId: string;
      appointmentId: string;
    }) => {
      return apiClient.put(`/api/v1/work-orders/${workOrderId}/appointments/${appointmentId}`, {
        action: "check-out",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Technician checked out successfully! Appointment completed.");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to check out.");
    },
  });

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
    mutationFn: async (newWO: typeof formData) => {
      return apiClient.post("/api/v1/work-orders", {
        ...newWO,
        accountId: newWO.accountId || null,
        contactId: newWO.contactId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setIsCreateModalOpen(false);
      setFormData({
        subject: "",
        description: "",
        accountId: "",
        contactId: "",
        status: "New",
        priority: "Medium",
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

  const [isEditingAlternatePhone, setIsEditingAlternatePhone] = useState(false);
  const [alternatePhoneInput, setAlternatePhoneInput] = useState("");

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

  // Generic Update Work Order Mutation
  const updateWorkOrderMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return apiClient.put(`/api/v1/work-orders/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Work order updated successfully.");
      setIsEditingAlternatePhone(false);
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to update work order.");
    },
  });

  // Schedule Appointment Mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedWorkOrderId) throw new Error("No work order selected");
      return apiClient.post(`/api/v1/work-orders/${selectedWorkOrderId}/appointments`, {
        ...payload,
        serviceResourceId: payload.serviceResourceId || null,
      });
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
        serviceResourceId: "",
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
      return apiClient.delete(
        `/api/v1/work-orders/${selectedWorkOrderId}/line-items/${lineItemId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", selectedWorkOrderId] });
      showToast("ok", "Line item removed successfully.");
    },
    onError: (err: any) => {
      showToast("err", err.message || "Failed to delete line item.");
    },
  });

  // Filter resources for service resources tab
  const filteredResources = useMemo(() => {
    return serviceResources.filter((r) => {
      const matchSearch =
        !resourceSearch.trim() ||
        r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        (r.email && r.email.toLowerCase().includes(resourceSearch.toLowerCase())) ||
        (r.skills && r.skills.some((s) => s.toLowerCase().includes(resourceSearch.toLowerCase())));
      const matchTerritory =
        resourceTerritoryFilter === "ALL" ||
        (r.territory && r.territory === resourceTerritoryFilter) ||
        (r.location && r.location === resourceTerritoryFilter);
      return matchSearch && matchTerritory;
    });
  }, [serviceResources, resourceSearch, resourceTerritoryFilter]);

  // Distinct territories list for filtering
  const distinctTerritories = useMemo(() => {
    const set = new Set<string>();
    serviceResources.forEach((r) => {
      const t = r.territory || r.location;
      if (t) set.add(t);
    });
    return Array.from(set);
  }, [serviceResources]);

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

        <div className="flex items-center gap-3">
          {/* Tab Navigation */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("work-orders")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "work-orders"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Work Orders ({workOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("service-resources")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "service-resources"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Service Resources ({serviceResources.length})
            </button>
          </div>

          {activeTab === "work-orders" ? (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="enterprise-btn-primary"
            >
              <Plus className="w-4 h-4" /> New Work Order
            </button>
          ) : (
            <button
              onClick={() => setIsResourceModalOpen(true)}
              className="enterprise-btn-primary"
            >
              <Plus className="w-4 h-4" /> Add Service Resource
            </button>
          )}
        </div>
      </div>

      {/* WORK ORDERS TAB CONTENT */}
      {activeTab === "work-orders" && (
        <>
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
        </>
      )}

      {/* SERVICE RESOURCES TAB CONTENT */}
      {activeTab === "service-resources" && (
        <>
          {/* Service Resources Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="enterprise-card p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Technicians
              </div>
              <div className="text-xl font-extrabold text-slate-900">{serviceResources.length}</div>
              <div className="text-[11px] text-slate-500">Registered service resources</div>
            </div>

            <div className="enterprise-card p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active & Available
              </div>
              <div className="text-xl font-extrabold text-emerald-600">
                {serviceResources.filter((r) => r.isActive).length}
              </div>
              <div className="text-[11px] text-slate-500">Available for assignment</div>
            </div>

            <div className="enterprise-card p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Inactive Resources
              </div>
              <div className="text-xl font-extrabold text-slate-600">
                {serviceResources.filter((r) => !r.isActive).length}
              </div>
              <div className="text-[11px] text-slate-500">Off-duty or decommissioned</div>
            </div>

            <div className="enterprise-card p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Service Territories
              </div>
              <div className="text-xl font-extrabold text-blue-600">{distinctTerritories.length}</div>
              <div className="text-[11px] text-slate-500">Operational service regions</div>
            </div>
          </div>

          {/* Service Resources Search and Filter Bar */}
          <div className="enterprise-card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search technician name, email, skills..."
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                className="enterprise-input pl-9 w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Territory:</span>
                <select
                  value={resourceTerritoryFilter}
                  onChange={(e) => setResourceTerritoryFilter(e.target.value)}
                  className="enterprise-input py-1.5 text-xs"
                >
                  <option value="ALL">All Territories</option>
                  {distinctTerritories.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {(resourceTerritoryFilter !== "ALL" || resourceSearch) && (
                <button
                  onClick={() => {
                    setResourceTerritoryFilter("ALL");
                    setResourceSearch("");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Service Resources Table */}
          <div className="enterprise-card overflow-hidden">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Technician / User</th>
                  <th>Type</th>
                  <th>Territory</th>
                  <th>Skills</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="font-semibold text-slate-600">No service resources found</p>
                        <p className="text-xs text-slate-400">
                          {resourceSearch || resourceTerritoryFilter !== "ALL"
                            ? "Try adjusting your search query or territory filter."
                            : "Click '+ Add Service Resource' above to register technicians."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {r.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{r.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {r.email || "No email"} {r.phone ? `• ${r.phone}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="enterprise-badge bg-blue-50 text-blue-700 border-blue-200">
                          {r.resourceType || "Technician"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{r.territory || r.location || "Unassigned"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {r.skills && r.skills.length > 0 ? (
                            r.skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs italic">No skills listed</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`enterprise-badge ${
                            r.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setEditingResource(r);
                            setResourceFormData({
                              userId: r.userId || "",
                              territory: r.territory || r.location || "",
                              skills: (r.skills || []).join(", "),
                              resourceType: r.resourceType || "Technician",
                              isActive: r.isActive ?? true,
                              description: r.description || "",
                            });
                            setIsEditResourceModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                          title="Edit Service Resource"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

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

                  {/* Customer Account & Contact Phone Section */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600" /> Customer Account & Contact Phone
                      </div>
                      {activeWorkOrder.account?.name ? (
                        <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {activeWorkOrder.account.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned Account</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Read-Only Primary Phone */}
                      <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-1">
                        <div className="text-slate-500 font-medium flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-blue-500" /> Primary Phone (Read-Only)
                          </span>
                          {activeWorkOrder.phoneSource && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {activeWorkOrder.phoneSource}
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-xs pt-0.5">
                          {activeWorkOrder.primaryPhone || <span className="text-slate-400 font-sans italic">N/A</span>}
                        </div>
                      </div>

                      {/* Alternate / Work-Order-Specific Phone */}
                      <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-1">
                        <div className="text-slate-500 font-medium flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-500" /> Alternate / On-Site Phone
                          </span>
                          {!isEditingAlternatePhone && (
                            <button
                              onClick={() => {
                                setAlternatePhoneInput(activeWorkOrder.alternatePhone || "");
                                setIsEditingAlternatePhone(true);
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                            >
                              {activeWorkOrder.alternatePhone ? "Edit" : "+ Add"}
                            </button>
                          )}
                        </div>

                        {isEditingAlternatePhone ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              updateWorkOrderMutation.mutate({
                                id: activeWorkOrder.id,
                                payload: { alternatePhone: alternatePhoneInput.trim() || null }
                              });
                            }}
                            className="flex items-center gap-1.5 pt-0.5"
                          >
                            <input
                              type="text"
                              placeholder="e.g. +966 50 123 4567"
                              value={alternatePhoneInput}
                              onChange={(e) => setAlternatePhoneInput(e.target.value)}
                              className="enterprise-input text-xs py-1 px-2 w-full font-mono"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={updateWorkOrderMutation.isPending}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingAlternatePhone(false)}
                              className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-[11px]"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <div className="font-mono font-bold text-slate-900 text-xs pt-0.5">
                            {activeWorkOrder.alternatePhone ? (
                              <span className="text-emerald-700">{activeWorkOrder.alternatePhone}</span>
                            ) : (
                              <span className="text-slate-400 font-sans italic">None added</span>
                            )}
                          </div>
                        )}
                      </div>
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
                            className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2.5"
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
                              <span
                                className={`enterprise-badge ${
                                  sa.status === "Completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : sa.status === "In Progress"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
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
                              {sa.serviceResource ? (
                                <div className="flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  <User className="w-3 h-3 text-blue-500" />
                                  <span>{sa.serviceResource.name}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No technician assigned</span>
                              )}
                            </div>

                            {/* Check-In / Check-Out Actions & Timestamps */}
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                {sa.checkedInAt && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                                    <LogIn className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      In:{" "}
                                      {new Date(sa.checkedInAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </span>
                                )}
                                {sa.checkedOutAt && (
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium flex items-center gap-1">
                                    <LogOut className="w-3 h-3 text-blue-600" />
                                    <span>
                                      Out:{" "}
                                      {new Date(sa.checkedOutAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </span>
                                )}
                                {!sa.checkedInAt && !sa.checkedOutAt && (
                                  <span className="text-slate-400 italic">Pending technician arrival</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Check In button */}
                                {!sa.checkedInAt && sa.status !== "Completed" && sa.status !== "Canceled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      checkInAppointmentMutation.mutate({
                                        workOrderId: activeWorkOrder.id,
                                        appointmentId: sa.id,
                                      })
                                    }
                                    disabled={checkInAppointmentMutation.isPending}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                                    title="Mark technician arrival on-site"
                                  >
                                    <LogIn className="w-3 h-3" />
                                    <span>Check In</span>
                                  </button>
                                )}

                                {/* Check Out button */}
                                {sa.checkedInAt && !sa.checkedOutAt && sa.status !== "Completed" && sa.status !== "Canceled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      checkOutAppointmentMutation.mutate({
                                        workOrderId: activeWorkOrder.id,
                                        appointmentId: sa.id,
                                      })
                                    }
                                    disabled={checkOutAppointmentMutation.isPending}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                                    title="Mark service job completed"
                                  >
                                    <LogOut className="w-3 h-3" />
                                    <span>Check Out</span>
                                  </button>
                                )}

                                {sa.checkedOutAt && (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Completed</span>
                                  </span>
                                )}
                              </div>
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

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Technician</label>
                <select
                  value={appointmentFormData.serviceResourceId}
                  onChange={(e) =>
                    setAppointmentFormData({
                      ...appointmentFormData,
                      serviceResourceId: e.target.value,
                    })
                  }
                  className="enterprise-input w-full"
                >
                  <option value="">-- Select Technician (Optional) --</option>
                  {serviceResources
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.territory || r.location ? `(${r.territory || r.location})` : ""}
                      </option>
                    ))}
                </select>
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

      {/* ADD SERVICE RESOURCE MODAL */}
      {isResourceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Add Service Resource / Technician
              </h3>
              <button
                onClick={() => setIsResourceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!resourceFormData.userId) {
                  showToast("err", "Please select a user account to link.");
                  return;
                }
                const skillsArray = resourceFormData.skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                createServiceResourceMutation.mutate({
                  userId: resourceFormData.userId,
                  territory: resourceFormData.territory.trim() || undefined,
                  skills: skillsArray,
                  resourceType: resourceFormData.resourceType,
                  isActive: resourceFormData.isActive,
                  description: resourceFormData.description.trim() || undefined,
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select User Account <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={resourceFormData.userId}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, userId: e.target.value })
                  }
                  className="enterprise-input w-full"
                >
                  <option value="">-- Choose User --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    All existing users are already registered as service resources.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Resource Type</label>
                  <select
                    value={resourceFormData.resourceType}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, resourceType: e.target.value })
                    }
                    className="enterprise-input w-full"
                  >
                    <option value="Technician">Technician</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Crew">Crew</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Territory / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. North Zone, Bangalore"
                    value={resourceFormData.territory}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, territory: e.target.value })
                    }
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HVAC, Electrical, Plumbing, Diagnostic"
                  value={resourceFormData.skills}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, skills: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional technician qualifications or notes..."
                  value={resourceFormData.description}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, description: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-is-active"
                  checked={resourceFormData.isActive}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, isActive: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="create-is-active" className="text-xs text-slate-700 font-medium">
                  Active (Available for appointment assignments)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  className="enterprise-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createServiceResourceMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  {createServiceResourceMutation.isPending ? "Adding..." : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SERVICE RESOURCE MODAL */}
      {isEditResourceModalOpen && editingResource && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" /> Edit Service Resource: {editingResource.name}
              </h3>
              <button
                onClick={() => {
                  setIsEditResourceModalOpen(false);
                  setEditingResource(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const skillsArray = resourceFormData.skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                updateServiceResourceMutation.mutate({
                  id: editingResource.id,
                  payload: {
                    territory: resourceFormData.territory.trim() || undefined,
                    skills: skillsArray,
                    resourceType: resourceFormData.resourceType,
                    isActive: resourceFormData.isActive,
                    description: resourceFormData.description.trim() || undefined,
                  },
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Resource Type</label>
                  <select
                    value={resourceFormData.resourceType}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, resourceType: e.target.value })
                    }
                    className="enterprise-input w-full"
                  >
                    <option value="Technician">Technician</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Crew">Crew</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Territory / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. North Zone, Bangalore"
                    value={resourceFormData.territory}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, territory: e.target.value })
                    }
                    className="enterprise-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HVAC, Electrical, Plumbing, Diagnostic"
                  value={resourceFormData.skills}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, skills: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional technician qualifications or notes..."
                  value={resourceFormData.description}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, description: e.target.value })
                  }
                  className="enterprise-input w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={resourceFormData.isActive}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, isActive: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="edit-is-active" className="text-xs text-slate-700 font-medium">
                  Active (Available for appointment assignments)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditResourceModalOpen(false);
                    setEditingResource(null);
                  }}
                  className="enterprise-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateServiceResourceMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  {updateServiceResourceMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
