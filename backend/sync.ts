import { sequelize } from "@nexus-crm/database";

async function run() {
  await sequelize.sync({ force: true });
  console.log("Database synced and tables recreated");
  process.exit(0);
}
run();
