import { Database, sequelize } from "@nexus-crm/database";
import crypto from "crypto";

async function seedSharmaHistory() {
  console.log("Connecting to DB...");
  await Database.createConnection();
  console.log("DB connected successfully.");

  const companyName = "Sharma Global Enterprises";
  const email = "rahul.sharma@sharmaglobal.com";
  const phone = "+919632217484";

  // 1. Account
  console.log("Checking Account...");
  let account: any = await sequelize.models.Account.findOne({ where: { name: companyName } });
  if (!account) {
    account = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: companyName,
      industry: "Manufacturing",
      phone: phone,
      email: email,
      website: "https://sharmaglobal.com",
      status: "Active"
    });
    console.log("Created Account:", account.id);
  } else {
    console.log("Found existing Account:", account.id);
  }

  // 2. Current Lead
  console.log("Updating current lead...");
  const currentLead: any = await sequelize.models.Lead.findOne({
    where: { email: "rahul.sharma@sharmaglobal.com" }
  });

  if (currentLead) {
    await currentLead.update({
      accountId: account.id,
      customerId: account.id,
      company: companyName,
      communicationChannel: "email"
    });
    console.log("Updated current Lead:", currentLead.id);
  }

  // 3. Historical Lead 1: Porta Cabins inquiry
  console.log("Creating Historical Lead 1...");
  const pastLead1Id = crypto.randomUUID();
  await sequelize.models.Lead.create({
    id: pastLead1Id,
    leadNumber: `LD-2024-${Math.floor(10000 + Math.random() * 90000)}`,
    firstName: "Rahul",
    lastName: "Sharma",
    company: companyName,
    email: email,
    phone: phone,
    source: "WhatsApp Inbound",
    communicationChannel: "email",
    status: "CONVERTED",
    industry: "Manufacturing",
    assignedToId: currentLead?.assignedToId || null,
    leadScore: 92,
    budgetRange: "SAR 450,000",
    message: "Can I get 20 heavy-duty insulated porta cabins for our site expansion?",
    accountId: account.id,
    customerId: account.id,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  });

  // Activity for Historical Lead 1
  await sequelize.models.Activity.create({
    id: crypto.randomUUID(),
    leadId: pastLead1Id,
    type: "whatsapp_sms",
    outcome: "message received",
    notes: "Can I get 20 heavy-duty insulated porta cabins for our site expansion?",
    direction: "inbound",
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  });

  await sequelize.models.Activity.create({
    id: crypto.randomUUID(),
    leadId: pastLead1Id,
    type: "email",
    outcome: "Official Quotation #QT-2024-8110 sent via Email",
    notes: "Dispatched commercial quotation with technical specifications and 30-day delivery guarantee to rahul.sharma@sharmaglobal.com",
    direction: "outbound",
    createdAt: new Date(Date.now() - 178 * 24 * 60 * 60 * 1000)
  });

  // Deal for Historical Lead 1
  const deal1Id = crypto.randomUUID();
  await sequelize.models.Deal.create({
    id: deal1Id,
    name: "Sharma Global - 20x Modular Porta Cabins Site Supply",
    amount: 467000,
    leadId: pastLead1Id,
    accountId: account.id,
    ownerId: currentLead?.assignedToId || null,
    status: "WON",
    createdAt: new Date(Date.now() - 175 * 24 * 60 * 60 * 1000)
  });

  // Quote for Historical Deal 1
  await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    quoteNumber: "Q-9812",
    dealId: deal1Id,
    version: 1,
    totalAmount: 467000,
    status: "Accepted",
    sentVia: "EMAIL",
    createdAt: new Date(Date.now() - 178 * 24 * 60 * 60 * 1000)
  });

  console.log("✅ Successfully seeded Sharma Global historical leads, activities, deals, and quotes!");
  process.exit(0);
}

seedSharmaHistory().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
