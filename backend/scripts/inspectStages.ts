import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const stages = await sequelize.models.PipelineStage.findAll({ order: [["order", "ASC"]] });
  console.log("PipelineStages in DB:", stages.map((s: any) => ({
    id: s.id,
    name: s.name,
    order: s.order,
    probability: s.probability
  })));
  process.exit(0);
}

main().catch(console.error);
