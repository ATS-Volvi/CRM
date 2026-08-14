"use strict";

/**
 * Performance indexes migration
 * Adds indexes on the most frequently queried columns in the CRM.
 *
 * Benchmark impact (approximate):
 *  - leads.assignedToId: sales_rep data isolation filter on every GET /leads
 *  - leads.status / leads.source: common filter combinations in lead list
 *  - leads.createdAt / lastWhatsappAt: ORDER BY in lead list query
 *  - activities.leadId: JOIN in lead detail view & timeline
 *  - activities.createdById: per-user task queries in dashboard
 *  - deals.ownerId: pipeline & management dashboard aggregations
 *  - tasks/activities: used in "today" dashboard overdue queries
 *  - contacts.phone: WhatsApp lead deduplication lookup
 */
module.exports = {
  async up(queryInterface) {
    const safeIndex = async (table, columns, name) => {
      try {
        await queryInterface.addIndex(table, columns, {
          name,
          concurrently: false,
        });
      } catch (e) {
        // Index may already exist (SQLite doesn't support IF NOT EXISTS on addIndex)
        console.log(`Index ${name} skipped: ${e.message}`);
      }
    };

    // ── Leads ────────────────────────────────────────────────────────────────
    await safeIndex("Leads", ["assignedToId"], "idx_leads_assigned_to");
    await safeIndex("Leads", ["status"], "idx_leads_status");
    await safeIndex("Leads", ["source"], "idx_leads_source");
    await safeIndex("Leads", ["createdAt"], "idx_leads_created_at");
    await safeIndex("Leads", ["lastWhatsappAt"], "idx_leads_last_whatsapp");
    await safeIndex("Leads", ["company"], "idx_leads_company");
    await safeIndex("Leads", ["email"], "idx_leads_email");

    // ── Activities ───────────────────────────────────────────────────────────
    await safeIndex("Activities", ["leadId"], "idx_activities_lead");
    await safeIndex("Activities", ["createdById"], "idx_activities_created_by");
    await safeIndex("Activities", ["createdAt"], "idx_activities_created_at");
    await safeIndex("Activities", ["type"], "idx_activities_type");
    await safeIndex("Activities", ["dueDate"], "idx_activities_due_date");

    // ── Deals ────────────────────────────────────────────────────────────────
    await safeIndex("Deals", ["ownerId"], "idx_deals_owner");
    await safeIndex("Deals", ["leadId"], "idx_deals_lead");
    await safeIndex("Deals", ["stageId"], "idx_deals_stage");

    // ── Tasks ────────────────────────────────────────────────────────────────
    // Tasks live in Activities table with type='task'
    // Composite index covers: WHERE type='task' AND createdById=? AND isCompleted=false
    await safeIndex("Activities", ["type", "createdById", "isCompleted"], "idx_activities_task_owner");

    // ── Quotes ───────────────────────────────────────────────────────────────
    await safeIndex("Quotes", ["dealId"], "idx_quotes_deal");
    await safeIndex("Quotes", ["status"], "idx_quotes_status");

    // ── Contacts ─────────────────────────────────────────────────────────────
    await safeIndex("LeadContacts", ["leadId"], "idx_lead_contacts_lead");
    await safeIndex("LeadContacts", ["phone"], "idx_lead_contacts_phone");
    await safeIndex("LeadContacts", ["email"], "idx_lead_contacts_email");

    // ── Lead Stage History ───────────────────────────────────────────────────
    await safeIndex("LeadStageHistories", ["leadId"], "idx_stage_history_lead");

    // ── Notifications ────────────────────────────────────────────────────────
    await safeIndex("Notifications", ["userId"], "idx_notifications_user");
    await safeIndex("Notifications", ["isRead"], "idx_notifications_unread");
  },

  async down(queryInterface) {
    const indexes = [
      ["Leads", "idx_leads_assigned_to"],
      ["Leads", "idx_leads_status"],
      ["Leads", "idx_leads_source"],
      ["Leads", "idx_leads_created_at"],
      ["Leads", "idx_leads_last_whatsapp"],
      ["Leads", "idx_leads_company"],
      ["Leads", "idx_leads_email"],
      ["Activities", "idx_activities_lead"],
      ["Activities", "idx_activities_created_by"],
      ["Activities", "idx_activities_created_at"],
      ["Activities", "idx_activities_type"],
      ["Activities", "idx_activities_due_date"],
      ["Activities", "idx_activities_task_owner"],
      ["Deals", "idx_deals_owner"],
      ["Deals", "idx_deals_lead"],
      ["Deals", "idx_deals_stage"],
      ["Quotes", "idx_quotes_deal"],
      ["Quotes", "idx_quotes_status"],
      ["LeadContacts", "idx_lead_contacts_lead"],
      ["LeadContacts", "idx_lead_contacts_phone"],
      ["LeadContacts", "idx_lead_contacts_email"],
      ["LeadStageHistories", "idx_stage_history_lead"],
      ["Notifications", "idx_notifications_user"],
      ["Notifications", "idx_notifications_unread"],
    ];

    for (const [table, name] of indexes) {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (e) {
        console.log(`Remove index ${name} skipped: ${e.message}`);
      }
    }
  },
};
