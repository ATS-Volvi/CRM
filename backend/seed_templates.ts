import "dotenv/config";
import { sequelize } from "@nexus-crm/database";

async function seed() {
  await sequelize.sync();
  
  await sequelize.models.MessageTemplate.findOrCreate({
    where: { name: "quote_no_response_followup" },
    defaults: {
      id: require('crypto').randomUUID(),
      name: "quote_no_response_followup",
      channel: "email",
      subject: "Following up on your proposal - {{sender_company_name}}",
      body: "Hi {{lead_name}},<br><br>Just checking in on the proposal we sent you for {{quote_amount}}. Do you have any questions or need any adjustments before we proceed?<br><br>Best,<br>{{sender_company_name}}",
      triggerEvent: "quote_no_response"
    }
  });

  console.log("Quote No Response Follow-up template seeded.");
  process.exit(0);
}
seed();
