const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function run() {
  try {
    await sequelize.query(`ALTER TYPE "enum_Activities_type" ADD VALUE 'instagram_dm';`);
    console.log("Enum patched successfully.");
  } catch (e) {
    if (e.message && e.message.includes("already exists")) {
       console.log("Enum value already exists.");
    } else {
       console.error("Patch error:", e.message);
    }
  } finally {
    process.exit(0);
  }
}
run();
