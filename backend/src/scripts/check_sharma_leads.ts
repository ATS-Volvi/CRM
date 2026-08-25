import { Database, sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

async function checkSharma() {
  await Database.createConnection();
  const leads = await sequelize.models.Lead.findAll({
    where: {
      [Op.or]: [
        { company: { [Op.iLike]: "%sharma%" } },
        { firstName: { [Op.iLike]: "%sharma%" } },
        { lastName: { [Op.iLike]: "%sharma%" } },
        { email: { [Op.iLike]: "%sharma%" } }
      ]
    }
  });

  console.log("Found leads:", leads.length);
  for (const l of leads as any[]) {
    console.log(`Lead ID: ${l.id}, Name: ${l.firstName} ${l.lastName}, Company: ${l.company}, Email: ${l.email}, Phone: ${l.phone}, Source: ${l.source}, CommunicationChannel: ${l.communicationChannel}, Status: ${l.status}`);
    const activities = await sequelize.models.Activity.findAll({
      where: { leadId: l.id }
    });
    console.log(`  Activities count: ${activities.length}`);
    for (const a of activities as any[]) {
      console.log(`    Activity type: ${a.type}, outcome: ${a.outcome}, notes: ${a.notes?.slice(0, 50)}`);
    }
  }

  process.exit(0);
}

checkSharma().catch(err => {
  console.error(err);
  process.exit(1);
});
