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
