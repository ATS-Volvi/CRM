import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

export async function seedEnterpriseDemoData() {
  console.log("Seeding realistic enterprise demo data...");

  // 1. Ensure Default Admin & Sales Rep Users exist
  const adminId = "00000000-0000-0000-0000-000000000000";
  const rep1Id = crypto.randomUUID();
  const rep2Id = crypto.randomUUID();

  await sequelize.models.User.findOrCreate({
    where: { id: adminId },
    defaults: {
      id: adminId,
      name: "Admin User",
      email: "admin@nexus.com",
      password: "$2a$10$e.w2x8K5Z6H3L0L1A8vB5.H6mP3g1Y7vX8w9z0A1B2C3D4E5F6G7H", // password123
      role: "admin",
      maxOpenLeads: 50,
      isAvailable: true
    }
  });

  const rep1 = await sequelize.models.User.findOrCreate({
    where: { email: "sarah.jenkins@nexus.com" },
    defaults: {
      id: rep1Id,
      name: "Sarah Jenkins",
      email: "sarah.jenkins@nexus.com",
      password: "$2a$10$e.w2x8K5Z6H3L0L1A8vB5.H6mP3g1Y7vX8w9z0A1B2C3D4E5F6G7H",
      role: "sales_rep",
      maxOpenLeads: 25,
      isAvailable: true
    }
  });

  // 2. Seed Real Enterprise Customers & Companies
  const customer1 = await sequelize.models.Customer.findOrCreate({
    where: { email: "contacts@acmecorp.com" },
    defaults: {
      id: crypto.randomUUID(),
      name: "Acme Industrial Corp",
      email: "contacts@acmecorp.com",
      phone: "+1 (555) 234-5678",
      primaryContactName: "Robert Vance",
      industry: "Industrial Manufacturing",
      address: "100 Industrial Parkway, Chicago, IL"
    }
  });

  const customer2 = await sequelize.models.Customer.findOrCreate({
    where: { email: "info@apexlogistics.com" },
    defaults: {
      id: crypto.randomUUID(),
      name: "Apex Global Logistics",
      email: "info@apexlogistics.com",
      phone: "+1 (555) 876-5432",
      primaryContactName: "Elena Rostova",
      industry: "Logistics & Supply Chain",
      address: "450 Airport Boulevard, Atlanta, GA"
    }
  });

  // 3. Seed Realistic Leads
  const lead1Id = crypto.randomUUID();
  await sequelize.models.Lead.findOrCreate({
    where: { email: "j.miller@acmeindustrial.com" },
    defaults: {
      id: lead1Id,
      leadNumber: "LEAD-2026-001",
      firstName: "James",
      lastName: "Miller",
      email: "j.miller@acmeindustrial.com",
      company: "Acme Industrial Corp",
      industry: "Industrial Manufacturing",
      leadScore: 85,
      status: "Qualified",
      source: "Website Form",
      assignedToId: adminId,
      customerId: (customer1[0] as any).id
    }
  });

  const lead2Id = crypto.randomUUID();
  await sequelize.models.Lead.findOrCreate({
    where: { email: "m.ross@apexlogistics.com" },
    defaults: {
      id: lead2Id,
      leadNumber: "LEAD-2026-002",
      firstName: "Marcus",
      lastName: "Ross",
      email: "m.ross@apexlogistics.com",
      company: "Apex Global Logistics",
      industry: "Logistics & Supply Chain",
      leadScore: 92,
      status: "Contacted",
      source: "LinkedIn Inbound",
      assignedToId: adminId,
      customerId: (customer2[0] as any).id
    }
  });

  // 4. Seed Tasks, Call Logs, Meetings & Activities
  const TaskModel = sequelize.models.Task || (sequelize.models as any).Tasks;
  if (TaskModel) {
    await TaskModel.findOrCreate({
      where: { title: "Follow up on Q3 Equipment Pricing Proposal" },
      defaults: {
        id: crypto.randomUUID(),
        title: "Follow up on Q3 Equipment Pricing Proposal",
        description: "Review equipment discount terms with James Miller before month-end closure.",
        status: "Pending",
        priority: "High",
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        leadId: lead1Id,
        assignedToId: adminId
      }
    });
  }

  const CallLogModel = sequelize.models.CallLog || (sequelize.models as any).CallLogs;
  if (CallLogModel) {
    await CallLogModel.findOrCreate({
      where: { notes: "Discussed bulk order terms for 500 units." },
      defaults: {
        id: crypto.randomUUID(),
        leadId: lead1Id,
        direction: "Outbound",
        durationSeconds: 340,
        outcome: "Connected",
        notes: "Discussed bulk order terms for 500 units."
      }
    });
  }

  console.log("Enterprise demo data seeded successfully!");
}

seedEnterpriseDemoData().catch(console.error);
