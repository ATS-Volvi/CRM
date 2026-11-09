process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
process.env.COMPANY_SUPPORT_PHONE = "+1-800-555-0199";
process.env.COMPANY_NAME = "Nexus Field Systems Ltd";
process.env.BASE_URL = "http://localhost:5506";

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
  queueWorkOrderNotification,
  deliverWorkOrderNotification,
  handleWorkOrderStatusChange,
} from "../src/services/workOrderNotificationService";
import { seedDefaultMessageTemplates } from "../src/services/communicationService";

async function run() {
  await sequelize.authenticate();
  await seedDefaultMessageTemplates();

  // 1. Setup Customer with <script> and & in customer name
  const account = await Account.create({
    id: crypto.randomUUID(),
    name: "Acme Industrial & Mining <script>alert('xss-account')</script>",
    email: "customer_sample@example.com",
  });

  const contact = await Contact.create({
    id: crypto.randomUUID(),
    accountId: account.id,
    firstName: "Jane",
    lastName: "Doe & Sons <script>alert('xss-name')</script>",
    email: "customer_sample@example.com",
  });

  // 2. Setup Technician with EMPTY phone
  const techUser = await User.create({
    id: crypto.randomUUID(),
    name: "Alex Rivers",
    email: `tech_${Date.now()}@nexus.local`,
    password: "password123",
    role: "field_technician",
  });

  const techResource = await ServiceResource.create({
    id: crypto.randomUUID(),
    name: "Alex Rivers",
    resourceType: "Technician",
    userId: techUser.id,
    phone: null, // Strictly EMPTY technician phone
    isActive: true,
  });

  // 3. Create Work Order
  const wo = await WorkOrder.create({
    id: crypto.randomUUID(),
    workOrderNumber: `WO-SAMPLE-${Date.now().toString().slice(-5)}`,
    contactId: contact.id,
    street: "742 Evergreen Terrace",
    city: "Springfield",
    status: "New",
    priority: "High",
  });

  // 4. Create Service Appointment
  const sa = await ServiceAppointment.create({
    id: crypto.randomUUID(),
    appointmentNumber: `SA-SAMPLE-01`,
    workOrderId: wo.id,
    serviceResourceId: techResource.id,
    subject: "On-site Calibration & Inspection",
    status: "Scheduled",
    scheduledStartTime: new Date("2026-11-10T10:00:00Z"),
    scheduledEndTime: new Date("2026-11-10T12:00:00Z"),
  });

  console.log("================================================================================");
  console.log("SAMPLE EMAIL 1: TECHNICIAN_ASSIGNED");
  console.log("================================================================================");
  const notif1 = await queueWorkOrderNotification({
    workOrderId: wo.id,
    appointmentId: sa.id,
    type: "TECHNICIAN_ASSIGNED",
    dedupeKey: `SAMPLE:ASSIGN:${wo.id}:${Date.now()}`,
    notifyCustomer: true,
  });
  const delivered1: any = await deliverWorkOrderNotification(notif1.id);
  console.log(`SUBJECT:\n${delivered1._plainSubject}\n`);
  console.log(`PLAIN-TEXT BODY:\n${delivered1._plainBody}\n`);
  console.log(`HTML BODY:\n${delivered1._htmlContent}\n`);

  console.log("================================================================================");
  console.log("SAMPLE EMAIL 2: VISIT_UPDATED");
  console.log("================================================================================");
  const notif2 = await queueWorkOrderNotification({
    workOrderId: wo.id,
    appointmentId: sa.id,
    type: "VISIT_UPDATED",
    dedupeKey: `SAMPLE:UPDATE:${wo.id}:${Date.now()}`,
    notifyCustomer: true,
  });
  const delivered2: any = await deliverWorkOrderNotification(notif2.id);
  console.log(`SUBJECT:\n${delivered2._plainSubject}\n`);
  console.log(`PLAIN-TEXT BODY:\n${delivered2._plainBody}\n`);
  console.log(`HTML BODY:\n${delivered2._htmlContent}\n`);

  console.log("================================================================================");
  console.log("SAMPLE EMAIL 3: VISIT_CANCELLED");
  console.log("================================================================================");
  const notif3 = await queueWorkOrderNotification({
    workOrderId: wo.id,
    appointmentId: sa.id,
    type: "VISIT_CANCELLED",
    dedupeKey: `SAMPLE:CANCEL:${wo.id}:${Date.now()}`,
    notifyCustomer: true,
  });
  const delivered3: any = await deliverWorkOrderNotification(notif3.id);
  console.log(`SUBJECT:\n${delivered3._plainSubject}\n`);
  console.log(`PLAIN-TEXT BODY:\n${delivered3._plainBody}\n`);
  console.log(`HTML BODY:\n${delivered3._htmlContent}\n`);

  console.log("================================================================================");
  console.log("SAMPLE EMAIL 4: FEEDBACK_REQUEST");
  console.log("================================================================================");
  sa.status = "Completed";
  await sa.save();
  await handleWorkOrderStatusChange(wo.id, "Completed");
  const fbNotif = await WorkOrderNotification.findOne({
    where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    order: [["createdAt", "DESC"]],
  });
  const delivered4: any = await deliverWorkOrderNotification(fbNotif!.id);
  console.log(`SUBJECT:\n${delivered4._plainSubject}\n`);
  console.log(`PLAIN-TEXT BODY:\n${delivered4._plainBody}\n`);
  console.log(`HTML BODY:\n${delivered4._htmlContent}\n`);

  const feedbackRow = await WorkOrderFeedback.findOne({
    where: { workOrderId: wo.id },
    order: [["createdAt", "DESC"]],
  });
  console.log("GENERATED FEEDBACK RECORD IN DB:");
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
