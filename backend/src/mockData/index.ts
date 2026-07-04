export const mockLeads = [
  {
    id: "lead-1",
    name: "Acme Corp",
    contactName: "John Doe",
    email: "john@acme.co",
    source: "Website",
    status: "New",
    score: 85,
    value: 50000,
    createdAt: new Date().toISOString()
  },
  {
    id: "lead-2",
    name: "TechStart Inc",
    contactName: "Jane Smith",
    email: "jane@techstart.io",
    source: "Referral",
    status: "Active",
    score: 92,
    value: 120000,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export const mockPipeline = [
  {
    stage: "New Leads",
    totalValue: 125000,
    deals: [
      { id: "deal-1", name: "Global Logistics Inc.", value: 45000, company: "Global Logistics", lastActivity: "2 days ago", tag: "SME Tier", isUrgent: false },
      { id: "deal-2", name: "Nova Dynamics Ltd.", value: 12500, company: "Nova Dynamics", lastActivity: "8 days inactive", tag: "URGENT", isUrgent: true }
    ]
  },
  {
    stage: "Contacted",
    totalValue: 450000,
    deals: [
      { id: "deal-3", name: "Helix Healthcare", value: 120000, company: "Helix Health", lastActivity: "3 days in stage", progress: 40 }
    ]
  }
];

export const mockQuotes = [
  {
    id: "QT-2023-88219",
    client: "Horizon Logistics Corp",
    owner: "Alex Chen",
    opportunity: "Q4 Tech Upgrade #882",
    date: "Oct 24, 2023",
    status: "Draft",
    items: [
      { id: 1, name: "Enterprise Cloud Suite (Annual)", qty: 1, price: 12500, discount: 5, tax: 15, total: 11875 },
      { id: 2, name: "Priority Support - 24/7", qty: 12, price: 450, discount: 0, tax: 15, total: 5400 }
    ]
  }
];

export const mockPurchaseOrders = [
  { id: "PO-2023-001", client: "Acme Corp", amount: 45000.00, status: "Verified", date: "2023-10-24" },
  { id: "PO-2023-002", client: "TechStart Inc", amount: 120000.00, status: "Pending", date: "2023-10-23" }
];

export const mockPriceBook = [
  { id: 1, name: "CloudCompute Ultra-9", sku: "CC-U9-2024", category: "Cloud Services", msrp: 1499.00, floor_price: 1250.00, uplift: 12, status: "Active" },
  { id: 2, name: "Guardian FireWall Pro", sku: "GFW-PRO-X", category: "Cyber Security", msrp: 850.00, floor_price: 780.00, uplift: 5, status: "Review" },
  { id: 3, name: "Quantum Core Processor", sku: "QC-PROC-M1", category: "Hardware", msrp: 3200.00, floor_price: 2800.00, uplift: 15, status: "Active" },
  { id: 4, name: "API Gateway Connect", sku: "API-CONN-LT", category: "SaaS / Integration", msrp: 299.00, floor_price: 240.00, uplift: 0, status: "Active" }
];
export const mockApprovals = [
  { 
    id: "app-1", 
    reason: "15% Discount", 
    subReason: "Threshold Breach",
    isCritical: false,
    requestor: "Sameer Malik",
    region: "Dubai Hub",
    quoteName: "Etisalat Enterprise Q4",
    notes: "Standard cloud bundle + 2 years support...",
    value: 142500,
    date: "Oct 24, 2023"
  },
  { 
    id: "app-2", 
    reason: "Quote > $100k", 
    subReason: "High Value Policy",
    isCritical: false,
    requestor: "Fatima P.",
    region: "Riyadh Office",
    quoteName: "NEOM Infrastructure Ph1",
    notes: "Global site license for Phase 1 construction...",
    value: 890000,
    date: "Oct 23, 2023"
  },
  { 
    id: "app-3", 
    reason: "Non-standard Terms", 
    subReason: "Legal Review Required",
    isCritical: true,
    requestor: "Rahul J.",
    region: "Mumbai Hub",
    quoteName: "Tata Steel Modernization",
    notes: "Net 90 payment terms requested by client...",
    value: 45000,
    date: "Oct 23, 2023"
  }
];
export * from './assignmentRules';
