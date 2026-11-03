import request from "supertest";
import jwt from "jsonwebtoken";
import { createServer } from "../../server";
import { Database, sequelize } from "@nexus-crm/database";

const app = createServer();
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

describe("Site Inspection Holidays Access Control", () => {
  beforeAll(async () => {
    await Database.createConnection();
    await sequelize.sync();
  });

  const makeToken = (role: string) =>
    jwt.sign({ id: `user-${role}`, email: `${role}@example.com`, role }, JWT_SECRET, { expiresIn: "1h" });

  test("GET /site-inspections/holidays is rejected with 403 for sales_rep", async () => {
    const res = await request(app)
      .get("/api/v1/site-inspections/holidays")
      .set("Authorization", `Bearer ${makeToken("sales_rep")}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/i);
  });

  test("GET /site-inspections/holidays is rejected with 403 for site_manager", async () => {
    const res = await request(app)
      .get("/api/v1/site-inspections/holidays")
      .set("Authorization", `Bearer ${makeToken("site_manager")}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/i);
  });

  test("GET /site-inspections/holidays succeeds with 200 for ops_manager and admin", async () => {
    const opsRes = await request(app)
      .get("/api/v1/site-inspections/holidays")
      .set("Authorization", `Bearer ${makeToken("ops_manager")}`);
    expect(opsRes.status).toBe(200);

    const adminRes = await request(app)
      .get("/api/v1/site-inspections/holidays")
      .set("Authorization", `Bearer ${makeToken("admin")}`);
    expect(adminRes.status).toBe(200);
  });

  test("POST /site-inspections/holidays is rejected with 403 for non-approver roles", async () => {
    const res = await request(app)
      .post("/api/v1/site-inspections/holidays")
      .set("Authorization", `Bearer ${makeToken("sales_rep")}`)
      .send({ date: "2026-12-25", name: "Christmas" });
    expect(res.status).toBe(403);
  });
});
