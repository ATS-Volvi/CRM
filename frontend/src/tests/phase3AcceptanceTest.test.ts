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
  Activity,
  ApprovalRequest,
  ROLE_PERMISSIONS,
} from "../types";

import { normalizeOpportunity } from "../api/adapters";
import { queryKeys } from "../api/queryKeys";

describe("Phase 3 Frontend Type Safety & Contract Tests", () => {
  test("1. Lead Contract", () => {
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
    expect(sampleLead.status).toBe("NEW");
    expect(sampleLead.leadScore).toBe(85);
  });

  test("2. Converted Lead Contract", () => {
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
    const convertedLead: Lead = {
      ...sampleLead,
      status: "CONVERTED",
      convertedAt: new Date().toISOString(),
      convertedAccountId: "acc-201",
      convertedContactId: "con-301",
      convertedOpportunityId: "opp-401",
    };
    expect(convertedLead.status).toBe("CONVERTED");
    expect(convertedLead.convertedAccountId).toBeTruthy();
    expect(convertedLead.convertedContactId).toBeTruthy();
    expect(convertedLead.convertedOpportunityId).toBeTruthy();
  });

  test("3. Account & Contact Contracts", () => {
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
    expect(sampleAccount.legalName.length).toBeGreaterThan(0);
    expect(sampleAccount.status).toBe("Active");

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
    expect(sampleContact.accountId).toBe("acc-201");
    expect(sampleContact.isPrimary).toBe(true);
  });

  test("4. Opportunity & Quote Versioning Contracts", () => {
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
    expect(sampleOpportunity.stage).toBe("Requirements");
    expect(sampleOpportunity.estimatedValue).toBe(4500000);

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
      status: "Accepted",
      totalAmount: 4500000,
      grandTotal: 4500000,
      isFinalAgreed: true,
      acceptedAt: new Date().toISOString(),
      createdBy: "usr-sales-01",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(quoteV1.version).toBe(1);
    expect(quoteV2.version).toBe(2);
    expect(quoteV2.status).toBe("Accepted");
    expect(quoteV2.isFinalAgreed).toBe(true);
  });

  test("5. Order, Approval, Activity, and Adapter Normalizers Contracts", () => {
    const sampleOrder: Order = {
      id: "ord-601",
      orderNumber: "ORD-2026-00012",
      accountId: "acc-201",
      opportunityId: "opp-401",
      sourceQuoteId: "q-502",
      status: "Confirmed",
      totalAmount: 4500000,
      grandTotal: 4500000,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(sampleOrder.status).toBe("Confirmed");

    const sampleApproval: ApprovalRequest = {
      id: "app-701",
      quoteId: "q-502",
      approvalLevel: "TEAM_LEAD",
      status: "APPROVED",
      actualQuoteValue: 4500000,
      requestedBy: "usr-sales-01",
      approvedBy: "usr-lead-01",
      decision: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(sampleApproval.status).toBe("APPROVED");

    const sampleActivity: Activity = {
      id: "act-801",
      type: "meeting",
      accountId: "acc-201",
      opportunityId: "opp-401",
      quoteId: "q-502",
      orderId: "ord-601",
      subject: "Final Commercial Review & Order Confirmation",
      description: "Agreed on terms for Quote v2 and triggered order confirmation.",
      direction: "outbound",
      isCompleted: true,
      createdBy: "usr-sales-01",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(sampleActivity.type).toBe("meeting");

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
    expect(normalizedOpp.id).toBe("deal-999");
    expect(normalizedOpp.accountId).toBe("cust-888");
    expect(normalizedOpp.estimatedValue).toBe(120000);

    expect(queryKeys.leads.all[0]).toBe("leads");
    expect(ROLE_PERMISSIONS.admin.canApproveQuotes).toBe(true);
  });
});
