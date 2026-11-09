process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import {
  processPendingWorkOrderNotifications,
  deliverWorkOrderNotification,
  resendWorkOrderNotification,
  formatDateInTz,
  formatTimeWindowInTz,
  createSignedOptOutToken,
  isEmailOptedOut,
  createFeedbackToken,
  verifyFeedbackToken,
  validateWorkOrderNotificationConfigOnStartup,
} from "../../src/services/workOrderNotificationService";
import { seedDefaultMessageTemplates } from "../../src/services/communicationService";
import jwt from "jsonwebtoken";
import crypto from "crypto";

describe("Work Order Technician Assignment, Customer Notifications & Feedback E2E Tests", () => {
  let app: any;
  let adminToken: string;
  let upperAdminToken: string;
  let managerToken: string;
  let directorToken: string;
  let salesManagerToken: string;
  let repToken: string;

  let testAdminUser: any;
  let testManagerUser: any;
  let testDirectorUser: any;
  let testSalesManagerUser: any;
  let testRepUser: any;
  let testTechUser: any;
  let activeTechResource: any;
  let inactiveTechResource: any;

  beforeAll(async () => {
    app = createServer();

    // Create test users
    testAdminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "WO Admin",
      email: `wo_admin_${Date.now()}@test.com`,
      password: "password123",
      role: "admin",
    });

    testManagerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "WO Manager",
      email: `wo_manager_${Date.now()}@test.com`,
      password: "password123",
      role: "manager",
    });

    testDirectorUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "WO Director",
      email: `wo_director_${Date.now()}@test.com`,
      password: "password123",
      role: "director",
    });

    testSalesManagerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "WO Sales Manager",
      email: `wo_sm_${Date.now()}@test.com`,
      password: "password123",
      role: "sales_manager",
    });

    testRepUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "WO Rep",
      email: `wo_rep_${Date.now()}@test.com`,
      password: "password123",
      role: "sales_rep",
    });

    testTechUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Field Tech 1",
      email: `tech1_${Date.now()}@test.com`,
      password: "password123",
      role: "field_technician",
    });

    // Active Service Resource
    activeTechResource = await sequelize.models.ServiceResource.create({
      id: crypto.randomUUID(),
      name: "Field Tech 1",
      resourceType: "Technician",
      userId: testTechUser.id,
      isActive: true,
      phone: "+919876543210",
      territory: "North Zone",
    });

    // Inactive Service Resource
    inactiveTechResource = await sequelize.models.ServiceResource.create({
      id: crypto.randomUUID(),
      name: "Inactive Tech",
      resourceType: "Technician",
      isActive: false,
      phone: "+919876543211",
      territory: "South Zone",
    });

    // Generate JWTs
    const jwtSecret = process.env.JWT_SECRET || "default_secret";
    adminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: "admin" },
      jwtSecret
    );
    // Uppercase role test
    upperAdminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: "ADMIN" },
      jwtSecret
    );
    managerToken = jwt.sign(
      { id: testManagerUser.id, email: testManagerUser.email, role: "manager" },
      jwtSecret
    );
    directorToken = jwt.sign(
      { id: testDirectorUser.id, email: testDirectorUser.email, role: "director" },
      jwtSecret
    );
    salesManagerToken = jwt.sign(
      { id: testSalesManagerUser.id, email: testSalesManagerUser.email, role: "sales_manager" },
      jwtSecret
    );
    repToken = jwt.sign(
      { id: testRepUser.id, email: testRepUser.email, role: "sales_rep" },
      jwtSecret
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WORK_ORDER_EMAIL_TEST_ALLOWLIST;
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
    process.env.COMPANY_SUPPORT_PHONE = "+00 0000 000000";
  });

  test("1. Role-based authorization & case-insensitive roles (Item 1)", async () => {
    // 1. sales_rep CAN create a work order (POST /api/v1/work-orders open to authMiddleware)
    const createWoRes = await request(app)
      .post("/api/v1/work-orders")
      .set("Authorization", `Bearer ${repToken}`)
      .send({
        subject: "Rep Created Work Order",
        status: "New",
        priority: "Medium",
      });
    expect(createWoRes.status).toBe(201);
    const woId = createWoRes.body.id;

    // Create an unassigned appointment
    const sa: any = await sequelize.models.ServiceAppointment.create({
      id: crypto.randomUUID(),
      appointmentNumber: `SA-${Date.now().toString().slice(-6)}`,
      workOrderId: woId,
      subject: "Initial Inspection",
      status: "New",
      scheduledStartTime: new Date("2026-11-01T10:00:00.000Z"),
      scheduledEndTime: new Date("2026-11-01T12:00:00.000Z"),
    });

    // 2. sales_rep CANNOT assign technician -> 403 Forbidden
    const repAssignRes = await request(app)
      .put(`/api/v1/work-orders/${woId}/appointments/${sa.id}`)
      .set("Authorization", `Bearer ${repToken}`)
      .send({
        serviceResourceId: activeTechResource.id,
      });
    expect(repAssignRes.status).toBe(403);

    // 3. sales_rep CANNOT resend notification -> 403 Forbidden
    const repResendRes = await request(app)
      .post(`/api/v1/work-orders/${woId}/notifications/${crypto.randomUUID()}/resend`)
      .set("Authorization", `Bearer ${repToken}`)
      .send({});
    expect(repResendRes.status).toBe(403);

    // 4. director ALLOWED to assign technician -> 200 OK
    const directorAssignRes = await request(app)
      .put(`/api/v1/work-orders/${woId}/appointments/${sa.id}`)
      .set("Authorization", `Bearer ${directorToken}`)
      .send({
        serviceResourceId: activeTechResource.id,
      });
    expect(directorAssignRes.status).toBe(200);

    // 5. sales_manager ALLOWED to reassign technician -> 200 OK
    const smAssignRes = await request(app)
      .put(`/api/v1/work-orders/${woId}/appointments/${sa.id}`)
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        serviceResourceId: activeTechResource.id,
      });
    expect(smAssignRes.status).toBe(200);

    // 6. ADMIN (uppercase) and admin (lowercase) BOTH work
    const adminAssignRes = await request(app)
      .put(`/api/v1/work-orders/${woId}/appointments/${sa.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        serviceResourceId: activeTechResource.id,
      });
    expect(adminAssignRes.status).toBe(200);

    const upperAdminAssignRes = await request(app)
      .put(`/api/v1/work-orders/${woId}/appointments/${sa.id}`)
      .set("Authorization", `Bearer ${upperAdminToken}`)
      .send({
        serviceResourceId: activeTechResource.id,
      });
    expect(upperAdminAssignRes.status).toBe(200);

    // 7. manager REJECTED on admin-only route (GET /api/v1/approval-policy) -> 403 Forbidden
    const managerAdminRouteRes = await request(app)
      .get("/api/v1/approval-policy")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerAdminRouteRes.status).toBe(403);

    // admin ALLOWED on admin-only route -> 200 OK
    const adminAdminRouteRes = await request(app)
      .get("/api/v1/approval-policy")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAdminRouteRes.status).toBe(200);
  });

  test("2. Inactive technician rejected with 400 Bad Request", async () => {
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Test Inactive Tech",
      status: "New",
      priority: "Low",
    });

    const res = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Visit with inactive tech",
        serviceResourceId: inactiveTechResource.id,
        scheduledStartTime: "2026-11-02T10:00:00.000Z",
        scheduledEndTime: "2026-11-02T11:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inactive/i);
  });

  test("3. Scheduling overlap returns 409 Conflict with conflicting appointment number", async () => {
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Test Overlap",
      status: "New",
      priority: "Medium",
    });

    // Schedule 1st appointment: 14:00 to 16:00
    const firstRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "First booked visit",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-03T14:00:00.000Z",
        scheduledEndTime: "2026-11-03T16:00:00.000Z",
      });

    expect(firstRes.status).toBe(201);
    const firstApptNum = firstRes.body.appointmentNumber;

    // Schedule 2nd appointment overlapping: 15:00 to 17:00
    const overlapRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Conflicting visit",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-03T15:00:00.000Z",
        scheduledEndTime: "2026-11-03T17:00:00.000Z",
      });

    expect(overlapRes.status).toBe(409);
    expect(overlapRes.body.conflictingAppointmentNumber).toBe(firstApptNum);
    expect(overlapRes.body.message).toContain(firstApptNum);
  });

  test("4. Assignment creates notification row and dedupe key prevents duplication", async () => {
    // Create Account with email
    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Acme Industrial",
      email: "billing@acmeindustrial.com",
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Pump Repair",
      status: "New",
      priority: "High",
      accountId: account.id,
    });

    // Schedule appointment with active tech
    const apptRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Pump Repair On-Site",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-05T09:00:00.000Z",
        scheduledEndTime: "2026-11-05T11:00:00.000Z",
        notifyCustomer: true,
      });

    expect(apptRes.status).toBe(201);
    const appointmentId = apptRes.body.id;

    // Check notification row
    const notifications = await sequelize.models.WorkOrderNotification.findAll({
      where: { appointmentId, type: "VISIT_SCHEDULED" },
    });

    expect(notifications.length).toBe(1);
    const n = notifications[0] as any;
    expect(n.status).toBe("Pending");
    expect(n.recipientEmail).toBe("billing@acmeindustrial.com");
    expect(n.recipientSource).toBe("account");
    expect(n.dedupeKey).toBeTruthy();

    // Triggering notice creation again with same dedupeKey should not duplicate
    const dupeNotice = await (sequelize.models.WorkOrderNotification as any).findOrCreate({
      where: { dedupeKey: n.dedupeKey },
      defaults: {
        id: crypto.randomUUID(),
        workOrderId: wo.id,
        appointmentId,
        type: "VISIT_SCHEDULED",
        recipientEmail: "billing@acmeindustrial.com",
        status: "Pending",
      },
    });
    expect(dupeNotice[1]).toBe(false); // second element is created: false
  });

  test("5. Reassign/reschedule creates VISIT_UPDATED, Cancel creates VISIT_CANCELLED", async () => {
    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Delta Corp",
      email: "ops@deltacorp.com",
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Generator Servicing",
      status: "New",
      priority: "Medium",
      accountId: account.id,
    });

    // Initial schedule via endpoint
    const initialRes = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Generator Maintenance",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-06T10:00:00.000Z",
        scheduledEndTime: "2026-11-06T12:00:00.000Z",
        notifyCustomer: true,
      });

    expect(initialRes.status).toBe(201);
    const apptId = initialRes.body.id;

    // Reschedule time -> Creates VISIT_UPDATED
    const updateRes = await request(app)
      .put(`/api/v1/work-orders/${wo.id}/appointments/${apptId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        scheduledStartTime: "2026-11-06T14:00:00.000Z",
        scheduledEndTime: "2026-11-06T16:00:00.000Z",
        notifyCustomer: true,
      });

    expect(updateRes.status).toBe(200);

    const updatedNotices = await sequelize.models.WorkOrderNotification.findAll({
      where: { appointmentId: apptId, type: "VISIT_UPDATED" },
    });
    expect(updatedNotices.length).toBe(1);

    // Cancel appointment -> Creates VISIT_CANCELLED
    const cancelRes = await request(app)
      .put(`/api/v1/work-orders/${wo.id}/appointments/${apptId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "Canceled",
        notifyCustomer: true,
      });

    expect(cancelRes.status).toBe(200);

    const cancelNotices = await sequelize.models.WorkOrderNotification.findAll({
      where: { appointmentId: apptId, type: "VISIT_CANCELLED" },
    });
    expect(cancelNotices.length).toBe(1);
  });

  test("6. Missing customer email yields status Skipped", async () => {
    // Work order with no contact and no account
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "No Customer Email Test",
      status: "New",
      priority: "Low",
    });

    const res = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Visit with no email",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-07T09:00:00.000Z",
        scheduledEndTime: "2026-11-07T10:00:00.000Z",
        notifyCustomer: true,
      });

    expect(res.status).toBe(201);
    const apptId = res.body.id;

    const notices = await sequelize.models.WorkOrderNotification.findAll({
      where: { appointmentId: apptId },
    });
    expect(notices.length).toBe(1);
    expect((notices[0] as any).status).toBe("Skipped");
    expect((notices[0] as any).skipReason).toMatch(/no customer email/i);
  });

  test("7. Dry-run mode sends nothing and logs status DryRun", async () => {
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
    const sendSpy = jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mock" } as any);

    // Create a pending notification
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Dry Run Test",
      status: "New",
    });

    const notif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "VISIT_SCHEDULED",
      recipientEmail: "client@example.com",
      status: "Pending",
      dedupeKey: `DRYRUN_TEST_${Date.now()}`,
      metadata: {
        appointmentNumber: "SA-9999",
        subject: "Dry Run Visit",
        scheduledStartTime: new Date().toISOString(),
      },
    });

    // Run poller
    const processed = await processPendingWorkOrderNotifications();
    expect(processed.dryRun).toBeGreaterThanOrEqual(1);

    // Reload notification
    await notif.reload();
    expect(notif.status).toBe("DryRun");
    expect(notif.sentAt).toBeTruthy();
    // Real email library NOT called in dry run
    expect(sendSpy).not.toHaveBeenCalled();
  });

  test("8. Test allowlist skips non-allowlisted emails", async () => {
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "false";
    process.env.WORK_ORDER_EMAIL_TEST_ALLOWLIST = "allowed@company.com, tester@company.com";

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Allowlist Test",
      status: "New",
    });

    const notif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "VISIT_SCHEDULED",
      recipientEmail: "unauthorized@outsider.com",
      status: "Pending",
      dedupeKey: `ALLOWLIST_TEST_${Date.now()}`,
      metadata: {
        appointmentNumber: "SA-8888",
        subject: "Blocked Visit",
      },
    });

    await processPendingWorkOrderNotifications();

    await notif.reload();
    expect(notif.status).toBe("Skipped");
    expect(notif.skipReason).toContain("allowlist");

    // Reset env
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
    delete process.env.WORK_ORDER_EMAIL_TEST_ALLOWLIST;
  });

  test("9. Transactional emails ignore marketing opt-out, but feedback request respects it", async () => {
    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Opted Out Account",
      email: "optedout@test.com",
    });

    // Contact with marketing opt-out
    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "Opted",
      lastName: "OutCustomer",
      email: "optedout@test.com",
    });

    // Record opt-out in Lead
    await sequelize.models.Lead.create({
      id: crypto.randomUUID(),
      firstName: "Opted",
      lastName: "OutCustomer",
      email: "optedout@test.com",
      optedOutEmail: true,
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Opt Out Check",
      status: "New",
      contactId: contact.id,
    });

    // Schedule appointment (transactional)
    const res = await request(app)
      .post(`/api/v1/work-orders/${wo.id}/appointments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Field Repair",
        serviceResourceId: activeTechResource.id,
        scheduledStartTime: "2026-11-10T10:00:00.000Z",
        scheduledEndTime: "2026-11-10T11:00:00.000Z",
        notifyCustomer: true,
      });

    expect(res.status).toBe(201);
    const appointmentId = res.body.id;

    // Transactional notification should be Pending (not skipped for opt-out)
    const transNotif: any = await sequelize.models.WorkOrderNotification.findOne({
      where: { appointmentId, type: "VISIT_SCHEDULED" },
    });
    expect(transNotif).toBeTruthy();
    expect(transNotif.status).toBe("Pending");

    // Complete appointment
    await request(app)
      .put(`/api/v1/work-orders/${wo.id}/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Completed" });

    // Complete the work order -> Triggers FEEDBACK_REQUEST
    await request(app)
      .put(`/api/v1/work-orders/${wo.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Completed" });

    // Feedback request notification should be Skipped due to opt-out
    const feedbackNotif: any = await sequelize.models.WorkOrderNotification.findOne({
      where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    });
    expect(feedbackNotif).toBeTruthy();
    expect(feedbackNotif.status).toBe("Skipped");
    expect(feedbackNotif.skipReason).toMatch(/opted out/i);
  });

  test("10. Feedback request skipped if any line item is Pending Approval", async () => {
    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Approval Account",
      email: "approval@tester.com",
    });

    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "Approval",
      lastName: "Tester",
      email: "approval@tester.com",
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Pending Line Item WO",
      status: "In Progress",
      contactId: contact.id,
    });

    // Add a line item with status Pending Approval
    await sequelize.models.WorkOrderLineItem.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      description: "Discounted Motor Unit",
      status: "Pending Approval",
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500,
    });

    // Transition work order to Completed
    await request(app)
      .put(`/api/v1/work-orders/${wo.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Completed" });

    const feedbackNotice: any = await sequelize.models.WorkOrderNotification.findOne({
      where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    });

    expect(feedbackNotice).toBeTruthy();
    expect(feedbackNotice.status).toBe("Skipped");
    expect(feedbackNotice.skipReason).toMatch(/pending approval/i);
  });

  test("11. Public Feedback Portal: token validation, idempotency, XSS sanitization, 410 expiry, and rating <= 2 alert", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      subject: "Portal Test Work Order",
      status: "Completed",
      ownerId: testAdminUser.id,
    });

    const sa: any = await sequelize.models.ServiceAppointment.create({
      id: crypto.randomUUID(),
      appointmentNumber: `SA-${Date.now().toString().slice(-6)}`,
      workOrderId: wo.id,
      subject: "Portal Service Visit",
      status: "Completed",
      serviceResourceId: activeTechResource.id,
    });

    // Create feedback record with unconsumed token
    const fbRecord: any = await sequelize.models.WorkOrderFeedback.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      appointmentId: sa.id,
      serviceResourceId: activeTechResource.id,
      tokenHash,
      tokenExpiresAt: new Date(Date.now() + 30 * 86400000), // 30 days future
    });

    // (a) Unknown token returns 404
    const unknownRes = await request(app).get("/api/v1/public/feedback/invalidtokendata12345");
    expect(unknownRes.status).toBe(404);

    // (b) GET on valid feedback link returns details and records nothing
    const getRes = await request(app).get(`/api/v1/public/feedback/${rawToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.workOrderNumber).toBe(wo.workOrderNumber);
    expect(getRes.body.technicianFirstName).toBe("Field");
    expect(getRes.body.isAlreadySubmitted).toBe(false);

    // Verify fbRecord is still unsubmitted
    await fbRecord.reload();
    expect(fbRecord.submittedAt).toBeNull();

    // (c) POST with rating 2 and XSS comment
    const postRes = await request(app)
      .post(`/api/v1/public/feedback/${rawToken}`)
      .send({
        rating: 2,
        comment: "<script>alert('xss')</script><b>Service was delayed</b> and technician was late.",
      });

    expect(postRes.status).toBe(200);
    expect(postRes.body.rating).toBe(2);
    // HTML tags stripped
    expect(postRes.body.comment).not.toContain("<script>");
    expect(postRes.body.comment).not.toContain("<b>");
    expect(postRes.body.comment).toContain("Service was delayed");

    // Verify record in database
    await fbRecord.reload();
    expect(fbRecord.rating).toBe(2);
    expect(fbRecord.submittedAt).toBeTruthy();

    // (d) Management alert check for rating <= 2
    const inAppAlert = await sequelize.models.Notification.findOne({
      where: {
        userId: testAdminUser.id,
        type: "LOW_FEEDBACK_RATING",
      },
    });
    expect(inAppAlert).toBeTruthy();

    // (e) Second POST rejected with 400
    const secondPostRes = await request(app)
      .post(`/api/v1/public/feedback/${rawToken}`)
      .send({ rating: 5, comment: "Trying to overwrite" });
    expect(secondPostRes.status).toBe(400);

    // (f) Expired token returns 410 Gone
    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const expiredTokenHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");

    await sequelize.models.WorkOrderFeedback.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      tokenHash: expiredTokenHash,
      tokenExpiresAt: new Date(Date.now() - 3600000), // 1 hour in the past
    });

    const expiredGetRes = await request(app).get(`/api/v1/public/feedback/${expiredRawToken}`);
    expect(expiredGetRes.status).toBe(410);

    const expiredPostRes = await request(app)
      .post(`/api/v1/public/feedback/${expiredRawToken}`)
      .send({ rating: 5 });
    expect(expiredPostRes.status).toBe(410);
  });

  test("12. Date rendering formats in COMPANY_TIMEZONE", () => {
    process.env.COMPANY_TIMEZONE = "Asia/Kolkata";
    const sampleUtcDate = new Date("2026-11-15T09:30:00.000Z"); // 09:30 UTC = 15:00 IST (+05:30)
    const sampleEndDate = new Date("2026-11-15T11:30:00.000Z"); // 11:30 UTC = 17:00 IST (+05:30)

    const formattedDate = formatDateInTz(sampleUtcDate);
    expect(formattedDate).toMatch(/Nov 15, 2026/);

    const formattedWindow = formatTimeWindowInTz(sampleUtcDate, sampleEndDate);
    expect(formattedWindow).toMatch(/3:00 PM - 5:00 PM/i);
  });

  test("13. Poller atomic claim & retry failed notifications with backoff (Item 3.a)", async () => {
    delete process.env.WORK_ORDER_EMAIL_TEST_ALLOWLIST;
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";

    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Retry Account",
      email: "retry_customer@test.com",
    });

    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "Retry",
      lastName: "Customer",
      email: "retry_customer@test.com",
    });

    // Create a work order and a Failed notification with attempts = 1, updated 2 minutes ago
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-RETRY-${Date.now()}`,
      contactId: contact.id,
      status: "In Progress",
      priority: "Normal",
    });

    const notif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "retry_customer@test.com",
      status: "Failed",
      dedupeKey: `RETRY:${wo.id}`,
      attempts: 1,
      lastError: "Connection reset",
    });

    // Manually push updatedAt back 2 minutes to satisfy the 60-second backoff threshold
    const pastTime = new Date(Date.now() - 120 * 1000);
    await sequelize.query(
      `UPDATE WorkOrderNotifications SET updatedAt = :pastTime WHERE id = :id`,
      { replacements: { pastTime, id: notif.id } }
    );

    // Run poller processor
    const stats = await processPendingWorkOrderNotifications();
    expect(stats.processed).toBeGreaterThanOrEqual(1);

    // Reload notification: should now be DryRun or Sent (attempts incremented)
    await notif.reload();
    expect(["DryRun", "Sent"]).toContain(notif.status);
    expect(notif.attempts).toBe(2);

    // 2. Stale Processing reclamation test (Item 4)
    // Rows left in "Processing" for more than 5 minutes return to Pending and count as an attempt
    const stuckWo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-STUCK-${Date.now()}`,
      contactId: contact.id,
      status: "In Progress",
      priority: "Normal",
    });

    const stuckNotif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: stuckWo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "retry_customer@test.com",
      status: "Processing",
      dedupeKey: `STUCK:${stuckWo.id}`,
      attempts: 0,
    });

    // Push updatedAt back 6 minutes (>5 minutes threshold)
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString().replace("T", " ").replace("Z", " +00:00");
    await sequelize.query(
      `UPDATE WorkOrderNotifications SET updatedAt = :sixMinAgo WHERE id = :id`,
      { replacements: { sixMinAgo, id: stuckNotif.id } }
    );

    // Run poller processor: stuck row reverts to Pending with attempts incremented (Item 4)
    await processPendingWorkOrderNotifications();

    await stuckNotif.reload();
    expect(stuckNotif.status).toBe("Pending");
    expect(stuckNotif.attempts).toBe(1);

    // After backoff elapses, next poller tick claims and processes it to DryRun/Sent
    const retryTime = new Date(Date.now() - 65 * 1000).toISOString().replace("T", " ").replace("Z", " +00:00");
    await sequelize.query(
      `UPDATE WorkOrderNotifications SET updatedAt = :retryTime WHERE id = :id`,
      { replacements: { retryTime, id: stuckNotif.id } }
    );
    await processPendingWorkOrderNotifications();

    await stuckNotif.reload();
    expect(["DryRun", "Sent"]).toContain(stuckNotif.status);
    expect(stuckNotif.attempts).toBe(2);
  });

  test("14. Contact/Account recipient unsubscribe & suppression check (Item 3)", async () => {
    // 1. Unauthenticated request with arbitrary raw email: returns 404, creates no lead and suppresses nothing
    const arbitraryEmail = `arbitrary_${Date.now()}@domain.com`;
    const unauthGetRes = await request(app).get(`/api/v1/leads/unsubscribe/${encodeURIComponent(arbitraryEmail)}`);
    expect(unauthGetRes.status).toBe(404);

    const unauthPostRes = await request(app).post(`/api/v1/leads/unsubscribe/${encodeURIComponent(arbitraryEmail)}`);
    expect(unauthPostRes.status).toBe(404);

    const noLead = await sequelize.models.Lead.findOne({ where: { email: arbitraryEmail } });
    expect(noLead).toBeNull();

    const noSupp = await sequelize.models.EmailSuppression.findOne({ where: { email: arbitraryEmail } });
    expect(noSupp).toBeNull();
    expect(await isEmailOptedOut(arbitraryEmail)).toBe(false);

    // 2. Tampered and foreign tokens: suppress nothing and return 404
    const contactEmail = `contact_optout_${Date.now()}@domain.com`;
    const validToken = createSignedOptOutToken(contactEmail);
    const tamperedToken = validToken + "corrupted";
    const foreignSecretHmac = crypto.createHmac("sha256", "wrong-secret").update(`optout:${contactEmail}`).digest("hex");
    const foreignToken = `${Buffer.from(contactEmail).toString("base64url")}.${foreignSecretHmac}`;

    const tamperedRes = await request(app).get(`/api/v1/leads/unsubscribe/${tamperedToken}`);
    expect(tamperedRes.status).toBe(404);
    const foreignRes = await request(app).get(`/api/v1/leads/unsubscribe/${foreignToken}`);
    expect(foreignRes.status).toBe(404);

    // 3. GET on valid token suppresses NOTHING (renders form only)
    const optOutPageRes = await request(app).get(`/api/v1/leads/unsubscribe/${validToken}`);
    expect(optOutPageRes.status).toBe(200);
    expect(optOutPageRes.text).toContain("Unsubscribe Confirmation");

    let preCheckSupp = await sequelize.models.EmailSuppression.findOne({
      where: { email: contactEmail.toLowerCase() },
    });
    expect(preCheckSupp).toBeNull(); // GET suppressed nothing!

    // 4. POST on valid token suppresses address in EmailSuppressions table
    const optOutPostRes = await request(app).post(`/api/v1/leads/unsubscribe/${validToken}`);
    expect(optOutPostRes.status).toBe(200);

    const suppressionRecord = await sequelize.models.EmailSuppression.findOne({
      where: { email: contactEmail.toLowerCase() },
    });
    expect(suppressionRecord).toBeTruthy();
    expect(await isEmailOptedOut(contactEmail)).toBe(true);

    // 3. Suppressed address gets no feedback email (skipped with skipReason)
    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Unsub Account",
      email: contactEmail,
    });

    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "Unsub",
      lastName: "Contact",
      email: contactEmail,
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-SUPP-${Date.now()}`,
      contactId: contact.id,
      status: "In Progress",
    });

    await sequelize.models.ServiceAppointment.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      status: "Completed",
      schedStartTime: new Date(),
      schedEndTime: new Date(Date.now() + 3600000),
      actualStartTime: new Date(),
      actualEndTime: new Date(),
    });

    // Trigger work order status change to Completed
    const { handleWorkOrderStatusChange } = require("../../src/services/workOrderNotificationService");
    await handleWorkOrderStatusChange(wo.id, "Completed");

    // Verify feedback notification was Skipped with reason "Customer opted out of email"
    const fbNotif: any = await sequelize.models.WorkOrderNotification.findOne({
      where: { workOrderId: wo.id, type: "FEEDBACK_REQUEST" },
    });
    expect(fbNotif).toBeTruthy();
    expect(fbNotif?.status).toBe("Skipped");
    expect(fbNotif?.skipReason).toMatch(/opted out/i);
  });

  test("15. Boot template seeding preserves admin edits & creates no duplicates (Item 3.d)", async () => {
    const templateName = "work_order_technician_assigned";

    // Ensure initial templates are seeded
    await seedDefaultMessageTemplates();

    // Find template
    let tmpl: any = await sequelize.models.MessageTemplate.findOne({
      where: { name: templateName, channel: "email" },
    });
    expect(tmpl).toBeTruthy();

    // Admin edits template
    const customAdminSubject = "CUSTOM ADMIN EDITED SUBJECT";
    tmpl.subject = customAdminSubject;
    await tmpl.save();

    // Simulate backend boot seeding
    await seedDefaultMessageTemplates();

    // Verify admin edit was NOT overwritten
    await tmpl.reload();
    expect(tmpl.subject).toBe(customAdminSubject);

    // Verify count: exactly 1 template with this name & channel (no duplicate)
    const count = await sequelize.models.MessageTemplate.count({
      where: { name: templateName, channel: "email" },
    });
    expect(count).toBe(1);
  });

  test("16. Public feedback GET exposes strictly permitted fields and never private info (Item 3.e)", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Secret Corp",
      email: "secret_customer@privacy.com",
    });

    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "Secret",
      lastName: "Customer",
      email: "secret_customer@privacy.com",
      phone: "+15550001111",
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-PRIV-${Date.now()}`,
      contactId: contact.id,
      street: "123 Classified St",
      city: "Secret City",
      status: "Completed",
    });

    await sequelize.models.WorkOrderFeedback.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      serviceResourceId: activeTechResource.id,
      tokenHash,
      tokenExpiresAt: new Date(Date.now() + 86400000),
    });

    const getRes = await request(app).get(`/api/v1/public/feedback/${rawToken}`);
    expect(getRes.status).toBe(200);

    const bodyKeys = Object.keys(getRes.body);

    // Permitted fields only
    const allowedKeys = new Set([
      "workOrderNumber",
      "visitDate",
      "technicianFirstName",
      "rating",
      "comment",
      "preselectedRating",
      "isAlreadySubmitted",
      "submittedAt",
    ]);

    for (const key of bodyKeys) {
      expect(allowedKeys.has(key)).toBe(true);
    }

    // Explicitly verify sensitive / internal fields are completely excluded
    expect(getRes.body.id).toBeUndefined();
    expect(getRes.body.workOrderId).toBeUndefined();
    expect(getRes.body.appointmentId).toBeUndefined();
    expect(getRes.body.serviceResourceId).toBeUndefined();
    expect(getRes.body.email).toBeUndefined();
    expect(getRes.body.phone).toBeUndefined();
    expect(getRes.body.customerName).toBeUndefined();
    expect(getRes.body.street).toBeUndefined();
    expect(getRes.body.serviceAddress).toBeUndefined();
    expect(getRes.body.technicianPhone).toBeUndefined();
    expect(getRes.body.technicianEmail).toBeUndefined();

    // Verify technician first name only
    expect(getRes.body.technicianFirstName).toBe("Field");
  });

  test("17. Resend feedback rotates token & rating is recorded once per work order (Item 3.f)", async () => {
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-RESEND-${Date.now()}`,
      status: "Completed",
    });

    const fbId = crypto.randomUUID();
    const originalToken = createFeedbackToken(fbId, 1);
    const originalHash = crypto.createHash("sha256").update(originalToken).digest("hex");

    const fbRecord: any = await sequelize.models.WorkOrderFeedback.create({
      id: fbId,
      workOrderId: wo.id,
      tokenHash: originalHash,
      tokenVersion: 1,
      tokenExpiresAt: new Date(Date.now() + 86400000),
    });

    const initialNotif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "FEEDBACK_REQUEST",
      recipientEmail: "customer_resend@test.com",
      status: "DryRun",
      dedupeKey: `FEEDBACK:${wo.id}`,
    });

    // Resend notification (rotates token immediately by incrementing tokenVersion to 2)
    const resentNotif: any = await resendWorkOrderNotification(initialNotif.id);
    expect(resentNotif.dedupeKey).toContain("RESEND:");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Old token (version 1) must now be INVALID (404)
    const oldGetRes = await request(app).get(`/api/v1/public/feedback/${originalToken}`);
    expect(oldGetRes.status).toBe(404);

    // Reload fbRecord to verify tokenVersion changed to 2 and tokenHash changed
    await fbRecord.reload();
    expect(fbRecord.tokenVersion).toBe(2);
    expect(fbRecord.tokenHash).not.toBe(originalHash);

    // New token (version 2) is VALID (200)
    const newToken = createFeedbackToken(fbId, 2);
    const newGetRes = await request(app).get(`/api/v1/public/feedback/${newToken}`);
    expect(newGetRes.status).toBe(200);

    // Submit rating on fbRecord via new token
    const submitRes = await request(app)
      .post(`/api/v1/public/feedback/${newToken}`)
      .send({ rating: 5, comment: "Great service!" });
    expect(submitRes.status).toBe(200);

    // Duplicate submit on new token returns 400
    const dupSubmitRes = await request(app)
      .post(`/api/v1/public/feedback/${newToken}`)
      .send({ rating: 1, comment: "Overwriting rating" });
    expect(dupSubmitRes.status).toBe(400);
    expect(dupSubmitRes.body.alreadySubmitted).toBe(true);

    // Verify rating remained 5
    await fbRecord.reload();
    expect(fbRecord.rating).toBe(5);
  });

  test("18. Email Content: HTML escaping in HTML part only, plain text unescaped, WORK_ORDER_REPLY_TO support (Item 5)", async () => {
    delete process.env.WORK_ORDER_REPLY_TO;
    delete process.env.COMPANY_SUPPORT_PHONE;

    const account: any = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Smith & Sons",
      email: "smith_sons@test.com",
    });

    const contact: any = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: "D'Souza",
      lastName: "Smith & Sons <script>",
      email: "smith_sons@test.com",
    });

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-HTML-${Date.now()}`,
      contactId: contact.id,
      status: "In Progress",
    });

    const notif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "smith_sons@test.com",
      status: "Pending",
      dedupeKey: `HTMLTEST:${wo.id}`,
    });

    const delivered: any = await deliverWorkOrderNotification(notif.id);

    // Plain text part is NOT escaped (test "Smith & Sons" and "D'Souza")
    expect(delivered._plainBody).toContain("D'Souza");
    expect(delivered._plainBody).toContain("Smith & Sons");
    expect(delivered._plainBody).not.toContain("&amp;");
    expect(delivered._plainBody).not.toContain("&#039;");
    // "reply to this email" removed because WORK_ORDER_REPLY_TO is unset
    expect(delivered._plainBody).not.toContain("reply to this email");

    // HTML part IS escaped
    expect(delivered._htmlContent).toContain("Smith &amp; Sons");
    expect(delivered._htmlContent).toContain("D&#039;Souza");
    expect(delivered._htmlContent).toContain("&lt;script&gt;");
    expect(delivered._htmlContent).not.toContain("<script>");

    // Now test with WORK_ORDER_REPLY_TO set
    process.env.WORK_ORDER_REPLY_TO = "support@company.com";
    process.env.COMPANY_SUPPORT_PHONE = "+00 0000 000000";

    const notif2: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "smith_sons@test.com",
      status: "Pending",
      dedupeKey: `HTMLTEST2:${wo.id}`,
    });

    const delivered2: any = await deliverWorkOrderNotification(notif2.id);

    // "reply to this email" preserved because WORK_ORDER_REPLY_TO is set
    expect(delivered2._plainBody).toContain("reply to this email");
  });

  test("19. Live send guardrails: refuse when no contact route or when localhost links present (Part 2 Item 1.b)", async () => {
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "false";
    delete process.env.COMPANY_SUPPORT_PHONE;
    delete process.env.WORK_ORDER_REPLY_TO;
    process.env.BASE_URL = "https://crm.volvitech.com";

    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-GUARD-${Date.now()}`,
      status: "In Progress",
    });

    const notifNoContact: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "customer_guard@test.com",
      status: "Pending",
      dedupeKey: `NOCONTACT:${wo.id}`,
    });

    const deliveredNoContact: any = await deliverWorkOrderNotification(notifNoContact.id);
    expect(deliveredNoContact.status).toBe("Failed");
    expect(deliveredNoContact.lastError).toContain("neither COMPANY_SUPPORT_PHONE nor WORK_ORDER_REPLY_TO is configured");

    // Configure contact route, but set BASE_URL to localhost
    process.env.COMPANY_SUPPORT_PHONE = "+91 80 4000 5000";
    process.env.WORK_ORDER_REPLY_TO = "support@volvitech.com";
    process.env.BASE_URL = "http://localhost:5506";

    const notifLocalhost: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "FEEDBACK_REQUEST",
      recipientEmail: "customer_guard@test.com",
      status: "Pending",
      dedupeKey: `LOCALHOST:${wo.id}`,
    });

    const deliveredLocalhost: any = await deliverWorkOrderNotification(notifLocalhost.id);
    expect(deliveredLocalhost.status).toBe("Failed");
    expect(deliveredLocalhost.lastError).toContain("message contains localhost or 127.0.0.1 links");

    // Reset env
    process.env.WORK_ORDER_EMAIL_DRY_RUN = "true";
    delete process.env.BASE_URL;
  });

  test("20. Separate template wording for no-technician case (Part 2 Item 1.a)", async () => {
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-NOTECH-${Date.now()}`,
      status: "Completed",
    });

    const notifAssigned: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "notech@test.com",
      status: "Pending",
      dedupeKey: `NOTECH_ASSIGN:${wo.id}`,
    });

    const deliveredAssigned: any = await deliverWorkOrderNotification(notifAssigned.id);
    expect(deliveredAssigned._plainSubject).not.toContain("will visit");
    expect(deliveredAssigned._plainBody).toContain("A technician will be confirmed shortly prior to your visit.");

    const notifFeedback: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "FEEDBACK_REQUEST",
      recipientEmail: "notech@test.com",
      status: "Pending",
      dedupeKey: `NOTECH_FB:${wo.id}`,
    });

    const deliveredFeedback: any = await deliverWorkOrderNotification(notifFeedback.id);
    expect(deliveredFeedback._plainBody).toContain("feedback on your recent service experience");
    expect(deliveredFeedback._plainBody).not.toContain("service provided by A technician will be confirmed shortly");
  });

  test("21. Deterministic feedback token crash resilience & idempotency (Part 2 Item 3)", async () => {
    const wo: any = await sequelize.models.WorkOrder.create({
      id: crypto.randomUUID(),
      workOrderNumber: `WO-CRASH-${Date.now()}`,
      status: "Completed",
    });

    const fbId = crypto.randomUUID();
    const deterministicToken = createFeedbackToken(fbId, 1);
    const tokenHash = crypto.createHash("sha256").update(deterministicToken).digest("hex");

    const fbRecord: any = await sequelize.models.WorkOrderFeedback.create({
      id: fbId,
      workOrderId: wo.id,
      tokenHash,
      tokenVersion: 1,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const notif: any = await sequelize.models.WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: wo.id,
      type: "FEEDBACK_REQUEST",
      recipientEmail: "crash_test@test.com",
      status: "Pending",
      dedupeKey: `CRASH_FB:${wo.id}`,
    });

    // 1. First send: delivers email with deterministic link
    const delivered1: any = await deliverWorkOrderNotification(notif.id);
    expect(delivered1._plainBody).toContain(`/feedback/${deterministicToken}?rating=5`);

    notif.status = "Processing";
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace("T", " ").replace("Z", " +00:00");
    await sequelize.query(
      `UPDATE WorkOrderNotifications SET status = 'Processing', updatedAt = :tenMinAgo WHERE id = :id`,
      { replacements: { tenMinAgo, id: notif.id } }
    );

    // 3. Poller reclaims stale Processing notification (reverts to Pending)
    await processPendingWorkOrderNotifications();
    await notif.reload();
    expect(notif.status).toBe("Pending");
    expect(notif.attempts).toBe(2);

    // After backoff window elapses (attempts=2 -> 120s backoff), next poller tick claims and re-delivers
    const retryTime = new Date(Date.now() - 130 * 1000).toISOString().replace("T", " ").replace("Z", " +00:00");
    await sequelize.query(
      `UPDATE WorkOrderNotifications SET updatedAt = :retryTime WHERE id = :id`,
      { replacements: { retryTime, id: notif.id } }
    );
    await processPendingWorkOrderNotifications();
    await notif.reload();
    expect(["DryRun", "Sent"]).toContain(notif.status);

    // 4. The link from the FIRST email MUST still work (200 OK)
    const getRes = await request(app).get(`/api/v1/public/feedback/${deterministicToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.workOrderNumber).toBe(wo.workOrderNumber);

    // 5. Submit rating via the first email's link
    const postRes = await request(app)
      .post(`/api/v1/public/feedback/${deterministicToken}`)
      .send({ rating: 4, comment: "Completed after restart" });
    expect(postRes.status).toBe(200);

    // 6. Only ONE rating can be recorded (subsequent submit returns 400)
    const dupPostRes = await request(app)
      .post(`/api/v1/public/feedback/${deterministicToken}`)
      .send({ rating: 1, comment: "Duplicate submission" });
    expect(dupPostRes.status).toBe(400);
    expect(dupPostRes.body.alreadySubmitted).toBe(true);

    await fbRecord.reload();
    expect(fbRecord.rating).toBe(4);
  });
});
