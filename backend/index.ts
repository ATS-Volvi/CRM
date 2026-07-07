import "dotenv/config";
import { createServer } from "./server";
import { Database, sequelize } from "@nexus-crm/database";

const PORT = process.env.PORT || 5505;

const app = createServer();

const startServer = async () => {
  try {
    await Database.createConnection();
    // Sync models. In production, use migrations instead of sync()
    await sequelize.sync({ alter: true });
    console.log("Database models synced successfully.");
    
    app.listen(PORT, () => {
      console.log(`Nexus CRM backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
