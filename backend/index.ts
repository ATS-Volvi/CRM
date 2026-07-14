import "dotenv/config";
import { createServer } from "./server";
import { Database, sequelize } from "@nexus-crm/database";

const PORT = process.env.PORT || 5505;

const app = createServer();

const startServer = async () => {
  try {
    await Database.createConnection();
    // Sync models. In production, use migrations instead of sync()
    if (process.env.RUN_SYNC === "true") {
      if (process.env.USE_SQLITE === "true") {
        await sequelize.query("PRAGMA foreign_keys = OFF;");
      }
      await sequelize.sync({ alter: true });
      if (process.env.USE_SQLITE === "true") {
        await sequelize.query("PRAGMA foreign_keys = ON;");
      }
      console.log("Database models synced successfully.");
    } else {
      console.log("Database auto-sync skipped (RUN_SYNC != true).");
    }
    
    // Seed default message templates if not exists
    const { seedDefaultMessageTemplates } = require("./src/services/communicationService");
    await seedDefaultMessageTemplates();

    app.listen(PORT as number, '0.0.0.0', () => {
      console.log(`Nexus CRM backend running on port ${PORT}`);
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
