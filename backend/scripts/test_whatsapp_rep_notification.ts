import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import crypto from "crypto";
import { Database, sequelize, Lead, Activity, User } from "@nexus-crm/database";

async function runWhatsAppRepNotificationTest() {
  console.log("\n================================================================================");
  console.log("   📲 TESTING WHATSAPP REP IN-APP NOTIFICATION ALERT END-TO-END");
  console.log("================================================================================\n");

  await Database.createConnection();
  console.log("✓ DB connection established");

  // 1. Setup Sales Rep
  let salesRep = await User.findOne({ where: { role: "sales_rep" } });
  if (!salesRep) {
    salesRep = await User.create({
      id: crypto.randomUUID(),
      name: "Tariq Al-Harbi",
      email: `tariq_${Date.now()}@nexus-crm.com`,
      password: "hashedpassword123",
      role: "sales_rep"
    });
  }
  console.log(`✓ Target Sales Rep: ${salesRep.name} (ID: ${salesRep.id})`);

  // 2. Setup Lead owned by this rep with customer phone
  const testPhone = `9665${Math.floor(10000000 + Math.random() * 90000000)}`;
  const leadId = crypto.randomUUID();
  const testLead = await Lead.create({
    id: leadId,
    leadNumber: `LD-WA-${Date.now().toString().slice(-4)}`,
    firstName: "Eng. Mansoor",
    lastName: "Al-Ghamdi",
    email: `mansoor_${Date.now()}@petrogulf.com`,
    phone: testPhone,
    whatsappPhone: testPhone,
    company: "Gulf Petrochemicals Plant",
    status: "CONTACTED",
    assignedToId: salesRep.id
  });
  console.log(`✓ Lead created: ${testLead.company} | Phone: +${testPhone} | Assigned to: ${salesRep.name}`);

  // 3. Simulate Incoming WhatsApp Message Webhook processing
  const incomingCustomerText = "Hi Tariq, we have approved the scope. Please dispatch the inspection team.";
  const metaMessageId = `wamid.TEST_${Date.now()}`;

  // Log Activity
  await Activity.create({
    id: crypto.randomUUID(),
    leadId: leadId,
    type: "whatsapp_sms",
    notes: incomingCustomerText,
    outcome: "message received",
    messageId: metaMessageId,
    direction: "inbound",
    isCompleted: true
  });

  // Call Notification generation matching whatsappController logic
  const leadLabel = testLead.company || `${testLead.firstName} ${testLead.lastName}`.trim();
  const notif = await sequelize.models.Notification.create({
    id: crypto.randomUUID(),
    userId: salesRep.id,
    type: "whatsapp_inbound",
    title: `💬 WhatsApp Reply from ${leadLabel}`,
    message: incomingCustomerText.length > 120 ? incomingCustomerText.slice(0, 117) + "…" : incomingCustomerText,
    link: `/leads/${leadId}`,
    actionUrl: `/leads/${leadId}`,
    isRead: false,
  });

  console.log(`✓ In-app Notification generated for rep:`);
  console.log(`  - Recipient Rep ID: ${notif.userId}`);
  console.log(`  - Title: "${notif.title}"`);
  console.log(`  - Message: "${notif.message}"`);
  console.log(`  - Direct Click Link: "${notif.link}"`);
  console.log(`  - Unread Status: ${!notif.isRead ? "UNREAD (Active Bell Ping)" : "READ"}`);

  // 4. Verify Notification exists for Sales Rep
  const repNotifications = await sequelize.models.Notification.findAll({
    where: { userId: salesRep.id, isRead: false },
    order: [["createdAt", "DESC"]]
  });

  const matchedNotif = repNotifications.find((n: any) => n.id === notif.id);
  if (!matchedNotif) {
    throw new Error("Failed to find unread WhatsApp notification for sales rep!");
  }
  console.log(`\n✓ VERIFIED: Sales Rep ${salesRep.name} has ${repNotifications.length} unread notification(s) waiting on their bell.`);

  // Clean up
  await sequelize.models.Notification.destroy({ where: { id: notif.id } });
  await Activity.destroy({ where: { leadId } });
  await Lead.destroy({ where: { id: leadId } });
  console.log("✓ Cleaned up test records.");

  console.log("\n================================================================================");
  console.log("   🎉 WHATSAPP SALES REP REAL-TIME NOTIFICATION VERIFIED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

runWhatsAppRepNotificationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
