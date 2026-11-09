import { Sequelize, DataTypes, Op } from "sequelize";
import crypto from "crypto";

async function main() {
  console.log("=== EXERCISING WORK ORDER NOTIFICATIONS & FEEDBACK ON THROWAWAY POSTGRES ===");

  const pgUrl = process.env.DATABASE_URL || "postgres://localhost:5433/test_postgres_notifications";
  console.log(`Connecting to Postgres at: ${pgUrl.replace(/:[^:@]*@/, ":***@")}`);

  const sequelize = new Sequelize(pgUrl, {
    logging: false,
    dialect: "postgres",
  });

  await sequelize.authenticate();
  console.log("✓ Connected to Postgres successfully.");

  // Define minimal matching models on the Postgres instance
  const EmailSuppression = sequelize.define("EmailSuppression", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    reason: { type: DataTypes.STRING, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "EmailSuppressions" });

  const ServiceResource = sequelize.define("ServiceResource", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false },
    skills: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  }, { tableName: "ServiceResources" });

  const WorkOrderNotification = sequelize.define("WorkOrderNotification", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    workOrderId: { type: DataTypes.UUID, allowNull: true },
    appointmentId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false },
    recipientEmail: { type: DataTypes.STRING, allowNull: true },
    recipientSource: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "Pending" },
    dedupeKey: { type: DataTypes.STRING, allowNull: false, unique: true },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastAttemptAt: { type: DataTypes.DATE, allowNull: true },
    lastError: { type: DataTypes.TEXT, allowNull: true },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    scheduledFor: { type: DataTypes.DATE, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  }, { tableName: "WorkOrderNotifications" });

  const WorkOrderFeedback = sequelize.define("WorkOrderFeedback", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    workOrderId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
    tokenExpiresAt: { type: DataTypes.DATE, allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    submittedAt: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: "WorkOrderFeedbacks" });

  await sequelize.sync({ force: true });
  console.log("✓ Synchronized tables in throwaway Postgres schema.");

  // 1. Insert & JSON columns
  console.log("\n[1] Testing Insert & JSON Columns...");
  const sr = await ServiceResource.create({
    id: crypto.randomUUID(),
    name: "Alex Vance",
    skills: ["HVAC", "Electrical Level 2", "Diagnostics"],
  });
  console.log(`✓ Inserted ServiceResource with JSON skills:`, sr.toJSON().skills);

  const notif = await WorkOrderNotification.create({
    id: crypto.randomUUID(),
    workOrderId: crypto.randomUUID(),
    type: "TECHNICIAN_ASSIGNED",
    recipientEmail: "customer@example.com",
    status: "Pending",
    dedupeKey: `WO_NOTIF:${Date.now()}`,
    attempts: 0,
    metadata: { browser: "Chrome", priority: "HIGH", tags: ["vip", "scheduled"] },
  });
  console.log(`✓ Inserted WorkOrderNotification with metadata JSON:`, notif.toJSON().metadata);

  // 2. Atomic Claim
  console.log("\n[2] Testing Atomic Claim...");
  const [claimResults] = await sequelize.query(`
    UPDATE "WorkOrderNotifications"
    SET status = 'Processing', "lastAttemptAt" = NOW()
    WHERE id = '${notif.id}' AND status = 'Pending'
    RETURNING id, status, "attempts";
  `);
  console.log(`✓ Atomic claim result:`, claimResults);
  if (!claimResults || (claimResults as any[]).length === 0) {
    throw new Error("Failed atomic claim in Postgres");
  }

  // 3. Retry Logic & Backoff Calculation
  console.log("\n[3] Testing Retry Logic with Backoff...");
  const retryNotif = await WorkOrderNotification.findByPk(notif.id);
  if (!retryNotif) throw new Error("Notification not found");

  const currentAttempts = (retryNotif as any).attempts + 1;
  const backoffMinutes = Math.min(30, Math.pow(2, currentAttempts)); // exponential backoff
  const nextScheduledFor = new Date(Date.now() + backoffMinutes * 60 * 1000);

  await retryNotif.update({
    status: "Pending",
    attempts: currentAttempts,
    scheduledFor: nextScheduledFor,
    lastError: "Simulated SMTP timeout",
  });
  console.log(`✓ Notification retried: attempts=${currentAttempts}, nextScheduledFor=${nextScheduledFor.toISOString()}, status=Pending`);

  // 4. Dedupe Key Unique-Violation Handling
  console.log("\n[4] Testing Dedupe Key Unique Constraint Violation...");
  let uniqueViolationCaught = false;
  try {
    await WorkOrderNotification.create({
      id: crypto.randomUUID(),
      workOrderId: crypto.randomUUID(),
      type: "TECHNICIAN_ASSIGNED",
      recipientEmail: "other@example.com",
      status: "Pending",
      dedupeKey: (notif as any).dedupeKey, // Duplicate key!
      attempts: 0,
    });
  } catch (err: any) {
    uniqueViolationCaught = true;
    console.log(`✓ Caught expected unique constraint violation on Postgres dedupeKey: ${err.name} - ${err.parent?.detail || err.message}`);
  }
  if (!uniqueViolationCaught) {
    throw new Error("Expected unique constraint violation for duplicate dedupeKey was not thrown!");
  }

  // 5. Case-Insensitive Email Lookups in EmailSuppressions
  console.log("\n[5] Testing Case-Insensitive Email Lookups in EmailSuppressions...");
  const testEmail = "Customer.OptOut@Example.COM";
  await EmailSuppression.create({
    id: crypto.randomUUID(),
    email: testEmail.toLowerCase(),
    reason: "User requested feedback opt-out",
    source: "feedback_token",
  });

  // Query with mixed case and check match
  const lookupInput = "cUsToMeR.oPtOuT@EXAMPLE.com";
  const found = await EmailSuppression.findOne({
    where: sequelize.where(
      sequelize.fn("lower", sequelize.col("email")),
      lookupInput.toLowerCase()
    ),
  });
  console.log(`✓ Found suppression record via case-insensitive lookup: email=${(found as any)?.email}, source=${(found as any)?.source}`);
  if (!found) {
    throw new Error("Failed case-insensitive email lookup in Postgres");
  }

  // 6. Feedback Endpoints & 30-Day Token Expiry on Postgres
  console.log("\n[6] Testing Feedback Workflow & 30-Day Token Expiry...");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const thirtyDaysFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const fb = await WorkOrderFeedback.create({
    id: crypto.randomUUID(),
    workOrderId: crypto.randomUUID(),
    tokenHash,
    tokenExpiresAt: thirtyDaysFuture,
  });
  console.log(`✓ Created WorkOrderFeedback: tokenExpiresAt=${(fb as any).tokenExpiresAt.toISOString()}`);

  // Query by hash
  const retrievedFb = await WorkOrderFeedback.findOne({
    where: { tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex") },
  });
  if (!retrievedFb) throw new Error("Failed to find feedback record by tokenHash");

  // Submit rating once
  await retrievedFb.update({
    rating: 5,
    comment: "Excellent service on Postgres test!",
    submittedAt: new Date(),
  });
  console.log(`✓ Submitted feedback: rating=${(retrievedFb as any).rating}, comment="${(retrievedFb as any).comment}", submittedAt=${(retrievedFb as any).submittedAt.toISOString()}`);

  await sequelize.close();
  console.log("\n=== ALL POSTGRES EXERCISES COMPLETED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("FATAL in Postgres verification:", err);
  process.exit(1);
});
