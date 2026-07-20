import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";

const app = createServer();

describe("E2E: Social Lead Capture", () => {
  it("should capture a public lead and return 201 Created", async () => {
    const payload = {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe.test@example.com",
      company: "Social Tech",
      source: "LinkedIn",
      message: "I am interested in your services."
    };

    const response = await request(app)
      .post("/api/v1/public/leads")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("leadId");

    // Verify it was actually saved in DB
    const leadId = response.body.leadId;
    const lead = await sequelize.models.Lead.findByPk(leadId);
    
    expect(lead).toBeTruthy();
    expect((lead as any).email).toBe("jane.doe.test@example.com");
    expect((lead as any).source).toBe("LinkedIn");
    expect((lead as any).status).toBe("New");
  });

  it("should fail if missing required fields", async () => {
    const payload = {
      firstName: "Incomplete",
      // missing lastName and email
    };

    const response = await request(app)
      .post("/api/v1/public/leads")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("First name, last name, and email are required");
  });
});
