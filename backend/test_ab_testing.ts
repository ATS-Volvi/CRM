import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { triggerTemplatedEmail } from "./src/services/emailService";
import { trackEmailOpen, getAbTestStats, declareWinner } from "./src/controllers/messageTemplateController";
import { Request, Response } from "express";

async function testAbTesting() {
  await sequelize.sync();
  
  const templateId = require('crypto').randomUUID();

  // Create an A/B Test Template
  await sequelize.models.MessageTemplate.create({
    id: templateId,
    name: "onboarding_ab_test",
    channel: "email",
    subject: "Welcome to Nexus CRM (Variant A)",
    body: "Hi {{lead_name}}, this is the original welcome email.",
    isAbTest: true,
    variantBSubject: "Nexus CRM: Your Journey Begins (Variant B)",
    variantBBody: "Hello {{lead_name}}! We are thrilled to have you here (Variant B).",
  });

  console.log(`Created MessageTemplate: onboarding_ab_test`);

  // Mock sending 10 emails
  console.log("\n--- TRIGGERING 10 EMAILS ---");
  for (let i = 0; i < 10; i++) {
    await triggerTemplatedEmail("onboarding_ab_test", "test@example.com", {
      lead_name: "Tester"
    });
  }

  console.log("\n--- SIMULATING EMAIL OPENS (TRACKING PIXEL) ---");
  // Let's say Variant A got 2 opens, Variant B got 4 opens
  const mockTrackRequest = async (variant: string) => {
    const req = {
      params: { id: templateId },
      query: { variant }
    } as unknown as Request;
    const res = {
      writeHead: () => {},
      end: () => {}
    } as unknown as Response;
    await trackEmailOpen(req, res);
  }

  await mockTrackRequest('A');
  await mockTrackRequest('A');
  await mockTrackRequest('B');
  await mockTrackRequest('B');
  await mockTrackRequest('B');
  await mockTrackRequest('B');

  console.log("Simulated 2 opens for A, 4 opens for B.");

  console.log("\n--- VERIFYING STATS ---");
  const statsReq = { params: { id: templateId } } as unknown as Request;
  const statsRes = {
    json: function(data: any) {
      console.log(`Stats Response:`, data);
      return this;
    }
  } as unknown as Response;
  await getAbTestStats(statsReq, statsRes);

  console.log("\n--- DECLARING VARIANT B AS THE WINNER ---");
  const declareReq = {
    params: { id: templateId },
    body: { winnerVariant: 'B' }
  } as unknown as Request;
  const declareRes = {
    json: function(data: any) {
      console.log(`Declare Winner Response:`, data);
      return this;
    }
  } as unknown as Response;
  await declareWinner(declareReq, declareRes);

  console.log("\n--- TRIGGERING 1 FINAL EMAIL (SHOULD FORCE VARIANT B) ---");
  await triggerTemplatedEmail("onboarding_ab_test", "final@example.com", {
    lead_name: "Final Tester"
  });

  // Verify it added to B sends
  console.log("\n--- FINAL STATS ---");
  await getAbTestStats(statsReq, statsRes);
}

testAbTesting().then(() => setTimeout(() => process.exit(0), 3000));
