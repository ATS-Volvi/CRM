import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import { processPendingWebhooks } from "../../src/services/webhookProcessor";

const app = createServer();

describe("E2E: Webhook Reliability & Dead-Letter Queue", () => {
  let quoteId: string;
  let envelopeId: string;

  beforeAll(async () => {
    envelopeId = require('crypto').randomUUID();

    const user = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      email: "webhook.test@example.com",
      name: "Webhook Tester",
      password: "hash"
    });

    const lead = await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName: "Hook",
      lastName: "Tester",
      email: "hook@example.com",
      assignedToId: (user as any).id
    });

    const deal = await sequelize.models.Deal.create({
      id: require('crypto').randomUUID(),
      leadId: (lead as any).id,
      name: "Webhook Deal",
      amount: 1000,
      stage: "Proposal",
      assignedToId: (user as any).id
    });

    const quote = await sequelize.models.Quote.create({
      id: require('crypto').randomUUID(),
      dealId: (deal as any).id,
      amount: 1000,
      status: "Sent",
      docusignEnvelopeId: envelopeId
    });
    quoteId = (quote as any).id;
  });

  beforeEach(async () => {
    // Clear webhook events
    await sequelize.models.WebhookEvent.destroy({ where: {} });
  });

  it("should fast-acknowledge a webhook and save it to the queue", async () => {
    const payload = {
      event: "envelope-completed",
      data: {
        envelopeId: envelopeId
      }
    };

    const res = await request(app)
      .post("/api/v1/docusign/webhook")
      .send(payload);

    expect(res.status).toBe(200);

    const pendingEvents = await sequelize.models.WebhookEvent.findAll();
    expect(pendingEvents.length).toBe(1);
    expect((pendingEvents[0] as any).status).toBe("pending");
  });

  it("should process a pending webhook and update quote status", async () => {
    // 1. Manually insert pending event
    await sequelize.models.WebhookEvent.create({
      id: require('crypto').randomUUID(),
      source: "docusign",
      status: "pending",
      payload: JSON.stringify({
        event: "envelope-completed",
        data: { envelopeId }
      })
    });

    // 2. Run processor
    await processPendingWebhooks();

    // 3. Verify event is processed
    const events = await sequelize.models.WebhookEvent.findAll();
    expect((events[0] as any).status).toBe("processed");

    // 4. Verify business logic fired
    const quote = await sequelize.models.Quote.findByPk(quoteId);
    expect((quote as any).status).toBe("Accepted");
  });

  it("should retry failures and eventually move to dead-letter queue", async () => {
    const brokenPayload = JSON.stringify({
      event: "envelope-completed",
      data: { envelopeId: "non-existent-envelope-id" }
    });

    const eventId = require('crypto').randomUUID();
    await sequelize.models.WebhookEvent.create({
      id: eventId,
      source: "docusign",
      status: "pending",
      payload: brokenPayload
    });

    // Run 1: Fails, retryCount = 1
    await processPendingWebhooks();
    let event: any = await sequelize.models.WebhookEvent.findByPk(eventId);
    expect(event.status).toBe("failed");
    expect(event.retryCount).toBe(1);
    expect(event.errorMessage).toContain("No quote found");

    // Run 2: Fails, retryCount = 2
    await processPendingWebhooks();
    event = await sequelize.models.WebhookEvent.findByPk(eventId);
    expect(event.status).toBe("failed");
    expect(event.retryCount).toBe(2);

    // Run 3: Fails, retryCount = 3 -> dead_letter
    await processPendingWebhooks();
    event = await sequelize.models.WebhookEvent.findByPk(eventId);
    expect(event.status).toBe("dead_letter");
    expect(event.retryCount).toBe(3);

    // Run 4: Ignores dead_letter completely
    await processPendingWebhooks();
    event = await sequelize.models.WebhookEvent.findByPk(eventId);
    expect(event.retryCount).toBe(3); // Does not increment further
  });
});
