import "dotenv/config";
import { createServer } from "./server";
import { Database, sequelize } from "@nexus-crm/database";
import { checkOverdueTasks } from "./src/services/notificationService";
import { processScheduledEmails, processQuoteFollowUps } from "./src/services/emailService";

const PORT = process.env.PORT || 5505;

const app = createServer();

const startServer = async () => {
  try {
    await Database.createConnection();
    // Models are now synced via Sequelize migrations. Do not use sync()!
    console.log("Database connection established successfully.");
    
    // Seed default message templates if not exists
    const { seedDefaultMessageTemplates } = require("./src/services/communicationService");
    await seedDefaultMessageTemplates();

    app.listen(PORT as number, '0.0.0.0', () => {
      console.log(`Nexus CRM backend running on port ${PORT}`);
      // Setup simple cron job for checking overdue tasks every hour
      // (Using 1 hour = 3600000 ms)
      setInterval(() => {
        checkOverdueTasks().catch(console.error);
        processScheduledEmails().catch(console.error);
        processQuoteFollowUps().catch(console.error);
      }, 3600000);

      // Start Quote Expiry Scheduler
      const { startExpiryScheduler } = require("./src/services/expiryScheduler");
      startExpiryScheduler();
      
      // Start Scheduled Weekly Snapshot Reports
      const { startReportScheduler } = require("./src/services/scheduledReportService");
      startReportScheduler();

      // Start Lead Connector Scheduler
      const { startConnectorScheduler } = require("./src/services/connectorScheduler");
      startConnectorScheduler();
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
