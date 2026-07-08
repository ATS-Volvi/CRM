import "dotenv/config";
import { createServer } from "./server";
import { Database, sequelize } from "@nexus-crm/database";
import { checkOverdueTasks } from "./src/services/notificationService";

const PORT = process.env.PORT || 5505;

const app = createServer();

const startServer = async () => {
  try {
    await Database.createConnection();
    // Sync models. In production, use migrations instead of sync()
    await sequelize.sync({ alter: true });
    console.log("Database models synced successfully.");
    
    app.listen(PORT as number, '0.0.0.0', () => {
      console.log(`Nexus CRM backend running on port ${PORT}`);
      
      // Setup simple cron job for checking overdue tasks every hour
      // (Using 1 hour = 3600000 ms)
      setInterval(() => {
        checkOverdueTasks().catch(console.error);
      }, 3600000);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
