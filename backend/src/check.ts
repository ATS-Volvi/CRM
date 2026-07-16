import { sequelize } from "@nexus-crm/database";

async function main() {
  const count = await sequelize.models.Quote.count();
  console.log("Quotes Count:", count);
}

main();
