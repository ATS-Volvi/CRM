import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { createNotification } from "./src/services/notificationService";

async function run() {
  await sequelize.sync();
  console.log("Creating a simulated notification...");
  const n = await createNotification(
    "mock-user", // valid user id
    "success",
    "Deal Won! 🎉",
    "Congratulations! The deal Acme Mega Deal was marked as Won.",
    "/pipeline"
  );
  console.log("Notification created successfully:", JSON.stringify(n, null, 2));
  process.exit(0);
}
run();
