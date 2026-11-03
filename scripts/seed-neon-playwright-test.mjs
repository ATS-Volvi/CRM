import bcrypt from "bcryptjs";
import {
  sequelize,
  Database,
  User,
  Lead,
  SiteBase,
  SiteFacility,
  SiteInspection,
} from "@nexus-crm/database";

async function main() {
  process.env.DATABASE_URL = "postgres://localhost:5432/render_neon_playwright_test_db";
  await Database.createConnection();

  const hashedPassword = await bcrypt.hash("Password123!", 10);

  // 1. Admin user
  let admin = await User.findOne({ where: { email: "admin@test.local" } });
  if (!admin) {
    admin = await User.create({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Admin Tester",
      email: "admin@test.local",
      password: hashedPassword,
      role: "admin",
      isAvailable: true,
      maxOpenLeads: 50,
    });
  }

  // 2. Site Manager user
  let siteManager = await User.findOne({ where: { email: "site_manager@test.local" } });
  if (!siteManager) {
    siteManager = await User.create({
      id: "00000000-0000-0000-0000-000000000002",
      name: "Site Manager Tester",
      email: "site_manager@test.local",
      password: hashedPassword,
      role: "site_manager",
      isAvailable: true,
      maxOpenLeads: 50,
    });
  }

  // 3. SiteBase
  let base = await SiteBase.findOne({ where: { code: "BASE-DMM" } });
  if (!base) {
    base = await SiteBase.create({
      name: "Dammam Operations Base",
      code: "BASE-DMM",
      region: "Eastern Province",
      latitude: 26.4207,
      longitude: 50.0888,
      isActive: true,
    });
  }

  // 4. SiteFacility
  let facility = await SiteFacility.findOne({ where: { name: "Ras Tanura Disposal Facility" } });
  if (!facility) {
    facility = await SiteFacility.create({
      name: "Ras Tanura Disposal Facility",
      serviceType: "SEWAGE",
      lat: 26.65,
      lng: 50.15,
      isActive: true,
    });
  }

  // 5. Lead
  let lead = await Lead.findOne({ where: { email: "client@aramco.com" } });
  if (!lead) {
    lead = await Lead.create({
      id: "00000000-0000-0000-0000-000000000010",
      firstName: "Aramco",
      lastName: "Site Inspection",
      email: "client@aramco.com",
      company: "Saudi Aramco",
      status: "New Lead",
      assignedToId: siteManager.id,
    });
  }

  // 6. SiteInspection
  let inspection = await SiteInspection.findOne({ where: { inspectionNumber: "SI-TEST-001" } });
  if (!inspection) {
    inspection = await SiteInspection.create({
      id: "00000000-0000-0000-0000-000000000020",
      inspectionNumber: "SI-TEST-001",
      leadId: lead.id,
      status: "DRAFT",
      assignedToId: siteManager.id,
      requestedById: admin.id,
      siteName: "Juaymah Gas Plant",
      siteAddress: "Juaymah, Eastern Province",
      baseId: base.id,
      baseName: base.name,
      revision: 1,
    });
  }

  console.log("Seeding complete:");
  console.log("  Site Manager:", siteManager.email);
  console.log("  Inspection ID:", inspection.id);
  console.log("  Inspection #:", inspection.inspectionNumber);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
