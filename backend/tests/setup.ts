process.env.SITE_INSPECTION_GATE = "off";

if (process.env.DATABASE_URL) {
  process.env.USE_SQLITE = "false";
} else {
  process.env.USE_SQLITE = "true";
  process.env.DB_DIALECT = "sqlite";
  process.env.DB_STORAGE = "./test.sqlite";
}

jest.mock("sanitize-html", () => {
  return jest.fn((str: string, options: any) => {
    if (!str) return "";
    let res = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    if (options && options.allowedTags && options.allowedTags.length === 0) {
      res = res.replace(/<[^>]*>/g, "");
    }
    return res;
  });
});

import "dotenv/config";
delete process.env.DATABASE_URL;
process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = "./test.sqlite";

const { Database, sequelize } = require("@nexus-crm/database");

jest.setTimeout(60000);

beforeAll(async () => {
  if (process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1")) {
    try {
      require("pg").defaults.ssl = false;
      const s: any = sequelize;
      if (s.options?.dialectOptions?.ssl) delete s.options.dialectOptions.ssl;
      if (s.config?.dialectOptions?.ssl) delete s.config.dialectOptions.ssl;
      if (s.connectionManager?.config?.dialectOptions?.ssl) delete s.connectionManager.config.dialectOptions.ssl;
      if (s.connectionManager?.pool?._factory?.clientConfig?.ssl) delete s.connectionManager.pool._factory.clientConfig.ssl;
    } catch (e) {}
  }

  // Connect and sync fresh schema
  await Database.createConnection();
  const dialect = sequelize.getDialect();
  if (dialect === "sqlite") {
    await sequelize.query("PRAGMA journal_mode = WAL;").catch(() => {});
    await sequelize.query("PRAGMA busy_timeout = 30000;").catch(() => {});
    await sequelize.query("PRAGMA foreign_keys = OFF;");
    await sequelize.sync({ force: true });
    await sequelize.query("PRAGMA foreign_keys = ON;");
  } else if (dialect === "postgres") {
    const tableNames = [
      "SiteInspectionAttachments",
      "SiteInspectionServices",
      "SiteInspections",
      "SiteInspectorProfiles",
      "SiteInspectionSettings",
      "SiteHolidays",
      "SiteInspectionAuditLogs",
      "Activities",
      "Opportunities",
      "Deals",
      "Leads",
      "Users",
    ];
    for (const table of tableNames) {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE;`).catch(() => {});
    }
  }

  // Seed default admin user so that Activity's createdById constraint does not fail
  try {
    await sequelize.models.User.findOrCreate({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      defaults: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Admin User",
        email: "admin@nexus.com",
        password: "hashedpassword123",
        role: "admin",
        isAvailable: true,
        maxOpenLeads: 50
      }
    });
  } catch (e) {}
});

afterAll(async () => {
  // Teardown
});
