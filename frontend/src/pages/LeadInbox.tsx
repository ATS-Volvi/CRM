import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { StandardTable } from "../components/StandardTable";

export default function LeadInbox() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: leads, isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token
  });

  const filteredLeads = leads?.filter((lead: any) => {
    const numberStr = lead.leadNumber || "";
    const nameStr = `${lead.firstName} ${lead.lastName}`.toLowerCase();
    const companyStr = (lead.company || "").toLowerCase();
    const matchesSearch = 
      numberStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameStr.includes(searchQuery.toLowerCase()) ||
      companyStr.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const columns = [
    {
      key: "leadNumber",
      header: "Lead #",
      render: (lead: any) => (
        <Link to={`/leads/${lead.id}`} className="text-primary font-bold hover:underline">
          {lead.leadNumber || "N/A"}
        </Link>
      )
    },
    {
      key: "name",
      header: "Client Name",
      render: (lead: any) => (
        <div>
          <p className="font-bold text-foreground">{lead.firstName} {lead.lastName}</p>
          <p className="text-[10px] text-muted-foreground">{lead.company || "No Company"}</p>
        </div>
      )
    },
    {
      key: "company",
      header: "Company",
      render: (lead: any) => lead.company || "N/A"
    },
    {
      key: "industry",
      header: "Pipeline / Industry",
      render: (lead: any) => lead.industry || "General"
    },
    {
      key: "owner",
      header: "Owner",
      render: (lead: any) => lead.assignedTo?.name || "Unassigned"
    },
    {
      key: "leadScore",
      header: "Revenue Value",
      align: "right" as const,
      render: (lead: any) => formatCurrency(lead.leadScore * 100)
    },
    {
      key: "status",
      header: "Status",
      render: (lead: any) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
          {lead.status}
        </span>
      )
    },
    {
      key: "createdAt",
      header: "Last Contact Date",
      render: (lead: any) => new Date(lead.createdAt).toLocaleDateString()
    }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-foreground">Leads Inbox</h1>
          <p className="text-xs text-muted-foreground font-medium">Manage and convert lead opportunities</p>
        </div>
      </div>

      <StandardTable 
        columns={columns}
        data={filteredLeads}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={[
          { value: "New", label: "New" },
          { value: "Contacted", label: "Contacted" },
          { value: "Qualified", label: "Qualified" },
          { value: "Lost", label: "Lost" }
        ]}
        addLabel="+ Add Lead"
        onAddClick={() => navigate("/leads/new")}
        onExport={() => window.open("/api/v1/exports/leads", "_blank")}
      />
    </div>
  );
}

