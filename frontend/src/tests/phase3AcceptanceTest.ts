/**
 * Phase 3 Frontend Type Safety & Contract Verification Test
 * Verifies frontend types, normalizers, and API contracts against canonical CRM model.
 */

import {
  Lead,
  Account,
  Contact,
  Opportunity,
  Quote,
  Order,
  Fulfillment,
  Asset,
  Activity,
  ApprovalRequest,
  LeadSource,
  Campaign,
  Attribution,
  PaginatedResponse,
  ROLE_PERMISSIONS
} from "../types";

import {
  normalizeLead,
  normalizeAccount,
  normalizeContact,
  normalizeOpportunity,
  normalizeQuote,
  normalizeOrder,
  normalizeActivity,
  normalizeApproval,
  normalizePaginatedResponse
} from "../api/adapters";

import { queryKeys } from "../api/queryKeys";

export function verifyFrontendContracts(): { passed: boolean; results: Record<string, boolean> } {
  const results: Record<string, boolean> = {};

  // 1. Lead Type Verification
  const sampleLead: Lead = {
    id: "lead-101",
    leadNumber: "LD-2026-00001",
    firstName: "Ahmed",
    lastName: "Al-Mansoor",
    companyName: "Saudi Aramco Supplier LLC",
    email: "ahmed@aramcosupplier.sa",
    phone: "+966500112233",
    sourceChannel: "Website",
    status: "NEW",
    leadScore: 85,
    priority: "HIGH",
    temperature: "Warm",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Lead Contract"] = sampleLead.status === "NEW" && sampleLead.leadScore === 85;

  // 2. Converted Lead Verification
  const convertedLead: Lead = {
    ...sampleLead,
    status: "CONVERTED",
    convertedAt: new Date().toISOString(),
    convertedAccountId: "acc-201",
    convertedContactId: "con-301",
    convertedOpportunityId: "opp-401",
  };
  results["Converted Lead Contract"] =
    convertedLead.status === "CONVERTED" &&
    !!convertedLead.convertedAccountId &&
    !!convertedLead.convertedContactId &&
    !!convertedLead.convertedOpportunityId;

  // 3. Account Type Verification
  const sampleAccount: Account = {
    id: "acc-201",
    accountNumber: "ACC-2026-00100",
    legalName: "Saudi Aramco Supplier Limited",
    displayName: "Saudi Aramco Supplier LLC",
    industry: "Oil & Gas Equipment",
    territory: "Eastern Province",
    country: "Saudi Arabia",
    city: "Dhahran",
    status: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Account Contract"] = sampleAccount.legalName.length > 0 && sampleAccount.status === "Active";

  // 4. Contact Type Verification
  const sampleContact: Contact = {
    id: "con-301",
    accountId: "acc-201",
    firstName: "Ahmed",
    lastName: "Al-Mansoor",
    jobTitle: "Procurement Director",
    email: "ahmed@aramcosupplier.sa",
    phone: "+966500112233",
    isPrimary: true,
    status: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Contact Contract"] = sampleContact.accountId === "acc-201" && sampleContact.isPrimary === true;

  // 5. Opportunity Type Verification
  const sampleOpportunity: Opportunity = {
    id: "opp-401",
    opportunityNumber: "OPP-2026-00045",
    name: "Pipeline Valves & Actuators Expansion",
    accountId: "acc-201",
    primaryContactId: "con-301",
    ownerId: "usr-sales-01",
    estimatedValue: 4500000,
    currency: "SAR",
    stage: "Requirements",
    probability: 40,
    priority: "HIGH",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Opportunity Contract"] =
    sampleOpportunity.stage === "Requirements" && sampleOpportunity.estimatedValue === 4500000;

  // 6. Multiple Quote Versions Verification
  const quoteV1: Quote = {
    id: "q-501",
    quoteNumber: "QT-2026-0089",
    opportunityId: "opp-401",
    version: 1,
    status: "Superseded",
    totalAmount: 4800000,
    grandTotal: 4800000,
    isFinalAgreed: false,
    createdBy: "usr-sales-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const quoteV2: Quote = {
    id: "q-502",
    quoteNumber: "QT-2026-0089",
    opportunityId: "opp-401",
    previousQuoteId: "q-501",
    version: 2,
    status: "Superseded",
    totalAmount: 4600000,
    grandTotal: 4600000,
    isFinalAgreed: false,
    createdBy: "usr-sales-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const quoteV3: Quote = {
    id: "q-503",
    quoteNumber: "QT-2026-0089",
    opportunityId: "opp-401",
    previousQuoteId: "q-502",
    version: 3,
    status: "Accepted",
    totalAmount: 4500000,
    grandTotal: 4500000,
    isFinalAgreed: true,
    acceptedAt: new Date().toISOString(),
    createdBy: "usr-sales-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Multiple Quote Versions Contract"] =
    quoteV1.version === 1 && quoteV2.version === 2 && quoteV3.version === 3;

  // 7. Final Agreed Quote Verification
  results["Final Agreed Quote Contract"] =
    quoteV3.status === "Accepted" && quoteV3.isFinalAgreed === true && quoteV1.status === "Superseded";

  // 8. Order Type Verification
  const sampleOrder: Order = {
    id: "ord-601",
    orderNumber: "ORD-2026-00012",
    accountId: "acc-201",
    opportunityId: "opp-401",
    sourceQuoteId: "q-503",
    status: "Confirmed",
    totalAmount: 4500000,
    grandTotal: 4500000,
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Order Contract"] =
    sampleOrder.sourceQuoteId === "q-503" && sampleOrder.status === "Confirmed";

  // 9. Approval Request Verification
  const sampleApproval: ApprovalRequest = {
    id: "app-701",
    quoteId: "q-503",
    approvalLevel: "TEAM_LEAD",
    status: "APPROVED",
    actualQuoteValue: 4500000,
    requestedBy: "usr-sales-01",
    approvedBy: "usr-lead-01",
    decision: "APPROVED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Approval Request Contract"] =
    sampleApproval.approvalLevel === "TEAM_LEAD" && sampleApproval.status === "APPROVED";

  // 10. Universal Activity Verification
  const sampleActivity: Activity = {
    id: "act-801",
    type: "meeting",
    accountId: "acc-201",
    opportunityId: "opp-401",
    quoteId: "q-503",
    orderId: "ord-601",
    subject: "Final Commercial Review & Order Confirmation",
    description: "Agreed on terms for Quote v3 and triggered order confirmation.",
    direction: "outbound",
    isCompleted: true,
    createdBy: "usr-sales-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  results["Activity Contract"] =
    sampleActivity.type === "meeting" && sampleActivity.opportunityId === "opp-401";

  // 11. Normalizers Verification
  const rawBackendDeal = {
    id: "deal-999",
    name: "Legacy Deal Name",
    customerId: "cust-888",
    leadId: "lead-777",
    amount: 120000,
    stage: { name: "Negotiation", probability: 70 },
    createdAt: "2026-08-17T00:00:00Z",
  };
  const normalizedOpp = normalizeOpportunity(rawBackendDeal);
  results["Adapter Deal -> Opportunity"] =
    normalizedOpp.id === "deal-999" &&
    normalizedOpp.accountId === "cust-888" &&
    normalizedOpp.originatingLeadId === "lead-777" &&
    normalizedOpp.estimatedValue === 120000 &&
    normalizedOpp.stage === "Negotiation";

  // 12. Query Keys Verification
  results["Query Keys Contract"] =
    queryKeys.leads.all[0] === "leads" &&
    queryKeys.opportunities.all[0] === "opportunities" &&
    queryKeys.accounts.all[0] === "accounts";

  // 13. Permissions Verification
  results["Role Permissions Contract"] =
    ROLE_PERMISSIONS.admin.canApproveQuotes === true &&
    ROLE_PERMISSIONS.sales_rep.canViewInternalCost === false &&
    ROLE_PERMISSIONS.sales_manager.canApproveQuotes === true;

  const allPassed = Object.values(results).every(Boolean);
  return { passed: allPassed, results };
}
