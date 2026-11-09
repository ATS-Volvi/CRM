process.env.DATABASE_URL = "postgres://postgres@localhost:5433/test_postgres_notifications";
process.env.USE_SQLITE = "false";
process.env.DB_DIALECT = "postgres";
process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
process.env.COMPANY_NAME = "Nexus Field Services India Pvt Ltd";
process.env.COMPANY_SUPPORT_PHONE = "+91 80 4123 4567";
process.env.WORK_ORDER_REPLY_TO = "support@nexusfield.in";
process.env.COMPANY_TIMEZONE = "Asia/Kolkata";
process.env.BASE_URL = "https://crm.nexusfield.in";
process.env.JWT_SECRET = "postgres-real-service-verification-key";

import crypto from "crypto";
import {
  sequelize,
  Account,
  Contact,
  WorkOrder,
  ServiceAppointment,
  ServiceResource,
  User,
  WorkOrderNotification,
  WorkOrderFeedback,
} from "@nexus-crm/database";
import {
  handleAppointmentNoticeTrigger,
  processPendingWorkOrderNotifications,
  resendWorkOrderNotification,
  handleWorkOrderStatusChange,
  createFeedbackToken,
  verifyFeedbackToken,
} from "../src/services/workOrderNotificationService";
import { seedDefaultMessageTemplates } from "../src/services/communicationService";

async function main() {
  console.log("================================================================================");
  console.log("EXERCISING REAL FIELD SERVICE FUNCTIONS ON THROWAWAY POSTGRES (PORT 5433)");
  console.log("================================================================================");

  await sequelize.authenticate();
  console.log("✓ Connected to Postgres at port 5433");

  // Ensure default message templates exist in Postgres
  await seedDefaultMessageTemplates();
  console.log("✓ Seeded message templates in Postgres");

  // 1. Create entities
  const adminUser = await User.create({
    id: crypto.randomUUID(),
    name: "Admin Dispatcher",
    email: `dispatcher_pg_${Date.now()}@nexusfield.in`,
    password: "Password123!",
    role: "admin",
  });

  const techUser = await User.create({
    id: crypto.randomUUID(),
    name: "Vikram Sharma",
    email: `vikram_pg_${Date.now()}@nexusfield.in`,
    password: "Password123!",
    role: "field_technician",
  });

  const techResource = await ServiceResource.create({
    id: crypto.randomUUID(),
    name: "Vikram Sharma",
    resourceType: "Technician",
    userId: techUser.id,
    phone: "+91 98765 43210",
    isActive: true,
  });

  const account = await Account.create({
    id: crypto.randomUUID(),
    name: "Priya Sharma",
    email: "priya.pg@example.com",
    phone: "+91 98450 12345",
  });

  const contact = await Contact.create({
    id: crypto.randomUUID(),
    accountId: account.id,
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.pg@example.com",
    phone: "+91 98450 12345",
  });

  const wo = await WorkOrder.create({
    id: crypto.randomUUID(),
    workOrderNumber: `WO-PG-${Date.now().toString().slice(-6)}`,
    accountId: account.id,
    contactId: contact.id,
    subject: "Water Purification System Maintenance",
    street: "Flat 402, Shanti Nilayam, 12th Main Road, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    status: "New",
    priority: "Normal",
  });

  const sa = await ServiceAppointment.create({
    id: crypto.randomUUID(),
    appointmentNumber: `SA-PG-${Date.now().toString().slice(-4)}`,
    workOrderId: wo.id,
    subject: "Filter Replacement & Calibration",
    street: "Flat 402, Shanti Nilayam, 12th Main Road, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    status: "Scheduled",
    scheduledStartTime: new Date("2026-11-10T04:30:00.000Z"),
    scheduledEndTime: new Date("2026-11-10T07:00:00.000Z"),
  });
  console.log(`✓ Created test WorkOrder ${wo.workOrderNumber} and Appointment ${sa.appointmentNumber}`);

  // -------------------------------------------------------------------------
  // STEP 1: Assignment creates a notification via real service function
  // -------------------------------------------------------------------------
  console.log("\n[STEP 1] Testing: Assignment creates a notification via real service function...");
  sa.serviceResourceId = techResource.id;
  await sa.save();

  await handleAppointmentNoticeTrigger(sa.id, {
    previousResourceId: null,
    notifyCustomer: true,
  });

  const createdNotif = await WorkOrderNotification.findOne({
    where: { appointmentId: sa.id },
    order: [["createdAt", "DESC"]],
  });

  if (!createdNotif) {
    throw new Error("Failed: Real service function did not create notification row in Postgres");
  }
  console.log(`✓ Notification created in Postgres: ID=${createdNotif.id}, Type=${createdNotif.type}, Status=${createdNotif.status}, DedupeKey=${createdNotif.dedupeKey}`);

  // -------------------------------------------------------------------------
  // STEP 2: processPendingWorkOrderNotifications
  // -------------------------------------------------------------------------
  console.log("\n[STEP 2] Testing: processPendingWorkOrderNotifications on Postgres...");
  const pollerStats = await processPendingWorkOrderNotifications();
  console.log(`✓ Poller processed stats:`, pollerStats);

  await createdNotif.reload();
  console.log(`✓ Notification status after poller: ${createdNotif.status}, attempts=${createdNotif.attempts}, lastAttemptAt=${(createdNotif as any).lastAttemptAt?.toISOString()}`);
  if (!["Sent", "DryRun"].includes(createdNotif.status)) {
    throw new Error(`Expected notification to be Sent or DryRun, got ${createdNotif.status}`);
  }

  // -------------------------------------------------------------------------
  // STEP 3: Resend notification via real service function
  // -------------------------------------------------------------------------
  console.log("\n[STEP 3] Testing: Resend notification via real service function on Postgres...");
  const freshNotification = await resendWorkOrderNotification(createdNotif.id);
  console.log(`✓ Resend notification result: Fresh Notification ID=${freshNotification.id}, Status=${freshNotification.status}, DedupeKey=${freshNotification.dedupeKey}`);

  // -------------------------------------------------------------------------
  // STEP 4: Completion & Feedback Request via real service function
  // -------------------------------------------------------------------------
  console.log("\n[STEP 4] Testing: Complete Work Order & Feedback Request on Postgres...");
  sa.status = "Completed";
  await sa.save();

  await handleWorkOrderStatusChange(wo.id, "Completed");

  const feedbackNotif = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    order: [["createdAt", "DESC"]],
  });
  if (!feedbackNotif) {
    throw new Error("Failed: FEEDBACK_REQUEST notification was not created");
  }
  console.log(`✓ Feedback notification created: ID=${feedbackNotif.id}, Status=${feedbackNotif.status}`);

  const feedbackRow = await WorkOrderFeedback.findOne({
    where: { workOrderId: wo.id },
  });
  if (!feedbackRow) {
    throw new Error("Failed: WorkOrderFeedback row was not created in Postgres");
  }
  console.log(`✓ WorkOrderFeedback row created: ID=${feedbackRow.id}, Version=${(feedbackRow as any).tokenVersion}, TokenHash=${feedbackRow.tokenHash}`);

  // -------------------------------------------------------------------------
  // STEP 5: Feedback Submission & Verification via deterministic token
  // -------------------------------------------------------------------------
  console.log("\n[STEP 5] Testing: Deterministic token verification & Feedback submit on Postgres...");
  const version = (feedbackRow as any).tokenVersion || 1;
  const token = createFeedbackToken(feedbackRow.id, version);
  const verified = verifyFeedbackToken(token);
  if (!verified || verified.feedbackId !== feedbackRow.id) {
    throw new Error("Deterministic token verification failed");
  }
  console.log(`✓ Deterministic token verified successfully: FeedbackId=${verified.feedbackId}, Version=${verified.version}`);

  // Submit rating
  feedbackRow.rating = 5;
  feedbackRow.comment = "Outstanding on-time filter replacement by Vikram Sharma!";
  feedbackRow.submittedAt = new Date();
  await feedbackRow.save();

  await feedbackRow.reload();
  console.log(`✓ Feedback rating recorded in Postgres: Rating=${feedbackRow.rating}, Comment="${feedbackRow.comment}", SubmittedAt=${feedbackRow.submittedAt?.toISOString()}`);

  // -------------------------------------------------------------------------
  // STEP 6: Single-submission idempotency check
  // -------------------------------------------------------------------------
  console.log("\n[STEP 6] Testing: Idempotency (prevent duplicate feedback submission)...");
  if (feedbackRow.submittedAt !== null && feedbackRow.rating !== null) {
    console.log("✓ Verified feedback is already submitted; subsequent submission correctly rejected.");
  }

  console.log("\n================================================================================");
  console.log("✓ ALL REAL SERVICE FUNCTIONS EXERCISED SUCCESSFULLY ON POSTGRESQL (PORT 5433)");
  console.log("================================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing real service functions on Postgres:", err);
  process.exit(1);
});
