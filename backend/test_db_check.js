require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { Sequelize } = require('sequelize');

const sq = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function main() {
  try {
    await sq.authenticate();
    console.log('Connected to PostgreSQL successfully.');

    const [leads] = await sq.query('SELECT status, count(*) as c FROM "Leads" GROUP BY status');
    console.log('Postgres Leads statuses:', leads);

    const [stages] = await sq.query('SELECT id, name, "order" FROM "PipelineStages" ORDER BY "order"');
    console.log('Postgres PipelineStages:', stages);

    const [deals] = await sq.query('SELECT "stageId", count(*) as c FROM "Deals" GROUP BY "stageId"');
    console.log('Postgres Deals by stageId:', deals);

    const [dealsCols] = await sq.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Deals'");
    console.log('Deals columns:', dealsCols.map(c => c.column_name));

    const [leadsCols] = await sq.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Leads'");
    console.log('Leads columns:', leadsCols.map(c => c.column_name));

    const [dealsCust] = await sq.query('SELECT count(*) as total, count("customerId") as hasCust, count("accountId") as hasAcc FROM "Deals"');
    console.log('Deals customerId vs accountId counts:', dealsCust);

    const [leadsCust] = await sq.query('SELECT count(*) as total, count("customerId") as hasCust, count("accountId") as hasAcc FROM "Leads"');
    console.log('Leads customerId vs accountId counts:', leadsCust);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sq.close();
  }
}

main();
