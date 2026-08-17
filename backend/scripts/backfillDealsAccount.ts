import { sequelize } from "@nexus-crm/database";

async function backfill() {
  // 1. Deals accountId backfill
  await sequelize.query(`
    UPDATE "Deals"
    SET "accountId" = "customerId"
    WHERE "accountId" IS NULL AND "customerId" IS NOT NULL;
  `);

  // 2. Leads accountId backfill
  await sequelize.query(`
    UPDATE "Leads"
    SET "accountId" = "customerId"
    WHERE "accountId" IS NULL AND "customerId" IS NOT NULL;
  `);

  // 3. Any converted leads without accountId
  const [defaultAcc] = await sequelize.query(`
    SELECT id FROM "Accounts" ORDER BY "createdAt" ASC LIMIT 1;
  `);

  if (defaultAcc && (defaultAcc as any[]).length > 0) {
    const fallbackId = (defaultAcc as any[])[0].id;
    await sequelize.query(`
      UPDATE "Deals"
      SET "accountId" = :fallbackId, "customerId" = :fallbackId
      WHERE "accountId" IS NULL;
    `, { replacements: { fallbackId } });

    await sequelize.query(`
      UPDATE "Leads"
      SET "accountId" = :fallbackId, "customerId" = :fallbackId
      WHERE "accountId" IS NULL AND "status" = 'CONVERTED';
    `, { replacements: { fallbackId } });
  }

  const [resDeals] = await sequelize.query(`SELECT count(*) as count FROM "Deals" WHERE "accountId" IS NULL;`);
  const [resLeads] = await sequelize.query(`SELECT count(*) as count FROM "Leads" WHERE "status" = 'CONVERTED' AND "accountId" IS NULL;`);
  console.log("Remaining Deals with NULL accountId:", (resDeals as any)[0]?.count);
  console.log("Remaining Converted Leads with NULL accountId:", (resLeads as any)[0]?.count);
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
