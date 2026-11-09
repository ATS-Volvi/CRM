process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
process.env.COMPANY_NAME = "Nexus Field Services India Pvt Ltd";
process.env.COMPANY_SUPPORT_PHONE = "+91 80 4123 4567";
process.env.WORK_ORDER_REPLY_TO = "support@nexusfield.in";
process.env.COMPANY_TIMEZONE = "Asia/Kolkata";
process.env.BASE_URL = "https://crm.nexusfield.in";
process.env.JWT_SECRET = "normal-case-sample-secret-key-32b";

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
import { Op } from "sequelize";
import {
  handleAppointmentNoticeTrigger,
  queueWorkOrderNotification,
  deliverWorkOrderNotification,
  handleWorkOrderStatusChange,
} from "../src/services/workOrderNotificationService";
import { seedDefaultMessageTemplates } from "../src/services/communicationService";

async function run() {
  await sequelize.authenticate();
  await seedDefaultMessageTemplates();

  // 1. Staff user performing assignments
  const adminUser = await User.create({
    id: crypto.randomUUID(),
    name: "Operations Dispatcher",
    email: `dispatcher_${Date.now()}@nexusfield.in`,
    password: "Password123!",
    role: "admin",
  });

  // 2. Setup Customer in Bengaluru, India
  const account = await Account.create({
    id: crypto.randomUUID(),
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98450 12345",
  });

  const contact = await Contact.create({
    id: crypto.randomUUID(),
    accountId: account.id,
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98450 12345",
  });

  // 3. Setup Technician with full name and Indian mobile phone
  const techUser = await User.create({
    id: crypto.randomUUID(),
    name: "Vikram Sharma",
    email: `vikram.sharma_${Date.now()}@nexusfield.in`,
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

  // 4. Create Work Order with realistic Indian address
  const wo = await WorkOrder.create({
    id: crypto.randomUUID(),
    workOrderNumber: "WO-IND-2026-08912",
    accountId: account.id,
    contactId: contact.id,
    subject: "Water Purification System Annual Maintenance & Filter Replacement",
    street: "Flat 402, Shanti Nilayam, 12th Main Road, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    status: "New",
    priority: "Normal",
  });

  // 5. Create Service Appointment
  // 10:00 AM IST to 12:30 PM IST on 10 November 2026 (04:30 UTC to 07:00 UTC)
  const sa = await ServiceAppointment.create({
    id: crypto.randomUUID(),
    appointmentNumber: "SA-IND-2026-0144",
    workOrderId: wo.id,
    subject: "On-site Filter Service & Water Quality Testing",
    street: "Flat 402, Shanti Nilayam, 12th Main Road, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    status: "Scheduled",
    scheduledStartTime: new Date("2026-11-10T04:30:00.000Z"),
    scheduledEndTime: new Date("2026-11-10T07:00:00.000Z"),
  });

  console.log("================================================================================");
  console.log("SAMPLE EMAIL 1: TECHNICIAN_ASSIGNED (Normal Case)");
  console.log("================================================================================");
  // Real service function call: assign technician to appointment
  sa.serviceResourceId = techResource.id;
  await sa.save();
  await handleAppointmentNoticeTrigger(sa.id, { previousResourceId: null, notifyCustomer: true });

  const notif1 = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: { [Op.in]: ["TECHNICIAN_ASSIGNED", "VISIT_SCHEDULED"] } },
    order: [["createdAt", "DESC"]],
  });
  const delivered1: any = await deliverWorkOrderNotification(notif1!.id);
  console.log(`SUBJECT: ${delivered1._plainSubject}`);
  console.log("\n--- PLAIN TEXT BODY ---");
  console.log(delivered1._plainBody);
  console.log("-----------------------");

  console.log("\n================================================================================");
  console.log("SAMPLE EMAIL 2: VISIT_UPDATED (Rescheduled Window - Normal Case)");
  console.log("================================================================================");
  // Real service function call: reschedule appointment time window
  const prevStartTime = sa.scheduledStartTime;
  // Reschedule: 14:00 IST to 16:30 IST on 10 November 2026 (08:30 UTC to 11:00 UTC)
  sa.scheduledStartTime = new Date("2026-11-10T08:30:00.000Z");
  sa.scheduledEndTime = new Date("2026-11-10T11:00:00.000Z");
  await sa.save();

  await handleAppointmentNoticeTrigger(sa.id, {
    previousResourceId: techResource.id,
    previousStartTime: prevStartTime,
    notifyCustomer: true,
  });
  const notif2 = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: "VISIT_UPDATED" },
    order: [["createdAt", "DESC"]],
  });
  const delivered2: any = await deliverWorkOrderNotification(notif2!.id);
  console.log(`SUBJECT: ${delivered2._plainSubject}`);
  console.log("\n--- PLAIN TEXT BODY ---");
  console.log(delivered2._plainBody);
  console.log("-----------------------");

  console.log("\n================================================================================");
  console.log("SAMPLE EMAIL 3: VISIT_CANCELLED (Normal Case)");
  console.log("================================================================================");
  // Real service function call: cancel appointment
  sa.status = "Canceled";
  await sa.save();

  await handleAppointmentNoticeTrigger(sa.id, {
    previousStatus: "Scheduled",
    notifyCustomer: true,
  });
  const notif3 = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: "VISIT_CANCELLED" },
    order: [["createdAt", "DESC"]],
  });
  const delivered3: any = await deliverWorkOrderNotification(notif3!.id);
  console.log(`SUBJECT: ${delivered3._plainSubject}`);
  console.log("\n--- PLAIN TEXT BODY ---");
  console.log(delivered3._plainBody);
  console.log("-----------------------");

  console.log("\n================================================================================");
  console.log("SAMPLE EMAIL 4: FEEDBACK_REQUEST (Normal Case - Completed Work Order)");
  console.log("================================================================================");
  // Mark Service Appointment and Work Order completed via real service function
  sa.status = "Completed";
  await sa.save();
  await handleWorkOrderStatusChange(wo.id, "Completed");
  const fbNotif = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    order: [["createdAt", "DESC"]],
  });
  const delivered4: any = await deliverWorkOrderNotification(fbNotif!.id);
  console.log(`SUBJECT: ${delivered4._plainSubject}`);
  console.log("\n--- PLAIN TEXT BODY ---");
  console.log(delivered4._plainBody);
  console.log("-----------------------");
  console.log("\n--- HTML BODY (FEEDBACK EMAIL) ---");
  console.log(delivered4._htmlContent);
  console.log("----------------------------------");

  const feedbackRow = await WorkOrderFeedback.findOne({
    where: { workOrderId: wo.id },
    order: [["createdAt", "DESC"]],
  });
  console.log("\nFEEDBACK RECORD IN DATABASE:");
  console.log(`ID: ${feedbackRow?.id}`);
  console.log(`Token Version: ${(feedbackRow as any)?.tokenVersion}`);
  console.log(`Token Hash: ${feedbackRow?.tokenHash}`);
  console.log(`Token Expires At: ${feedbackRow?.tokenExpiresAt?.toISOString()}`);
  console.log("================================================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error generating sample emails:", err);
    process.exit(1);
  });
