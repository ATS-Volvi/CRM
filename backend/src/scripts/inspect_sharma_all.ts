import { Database, sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

async function inspectSharmaAll() {
  await Database.createConnection();
  
  const accounts = await sequelize.models.Account.findAll({
    where: {
      name: { [Op.iLike]: "%sharma%" }
    }
  });
  console.log("Accounts matching Sharma:", accounts.map((a: any) => ({ id: a.id, name: a.name, industry: a.industry })));

  const leads = await sequelize.models.Lead.findAll({
    where: {
      [Op.or]: [
        { company: { [Op.iLike]: "%sharma%" } },
        { email: { [Op.iLike]: "%sharma%" } },
        { firstName: { [Op.iLike]: "%rahul%" } }
      ]
    }
  });
  console.log("Leads matching Sharma:", leads.map((l: any) => ({ id: l.id, leadNumber: l.leadNumber, company: l.company, email: l.email, source: l.source, status: l.status })));

  const deals = await sequelize.models.Deal.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: "%sharma%" } },
        { accountId: { [Op.in]: accounts.map((a: any) => a.id) } },
        { leadId: { [Op.in]: leads.map((l: any) => l.id) } }
      ]
    }
  });
  console.log("Deals matching Sharma:", deals.map((d: any) => ({ id: d.id, name: d.name, amount: d.amount })));

  process.exit(0);
}

inspectSharmaAll().catch(console.error);
