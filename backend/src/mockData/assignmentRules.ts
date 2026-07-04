export const mockAssignmentRules = [
  {
    id: "rule-1",
    name: "Product Focus",
    description: "Match lead interest to product experts",
    type: "product",
    condition: "Interest ∈ [Enterprise SaaS, Fintech]",
    action: "Tier 1 Sales",
    active: true
  },
  {
    id: "rule-2",
    name: "Regional Routing",
    description: "Assign leads by territory",
    type: "geo",
    condition: 'Region = "GCC Markets"',
    action: "Dubai Hub Team",
    active: true
  },
  {
    id: "rule-3",
    name: "Global Round Robin",
    description: "Cyclical distribution for general leads",
    type: "round-robin",
    condition: "Unmatched by priority rules",
    action: "Shared Pool A",
    active: true
  },
  {
    id: "rule-4",
    name: "Skill-Based Filter",
    description: "Route by certification level",
    type: "skill",
    condition: "Certifications includes 'AWS'",
    action: "Tech Team",
    active: false
  }
];
