import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

async function checkEmmaDeals() {
  try {
    await sequelize.authenticate();
    console.log("=== CHECKING EMMA WATSON DEALS IN DATABASE ===");

    const emmaUsers = await sequelize.models.User.findAll({
      where: {
        [Op.or]: [
          { email: "emmawatson@nexus.com" },
          { email: "salesperson2@nexus.com" },
          { name: { [Op.like]: "%Emma%" } }
        ]
      }
    });

    console.log("Found Emma Users:", emmaUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role })));

    for (const emma of emmaUsers) {
      const eId = (emma as any).id;
      const deals = await sequelize.models.Deal.findAll({
        where: { ownerId: eId },
        include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
      });

      console.log(`\nDeals currently owned by ${emma.get("name")} (${emma.get("email")}): ${deals.length} deals`);
      deals.forEach((d: any) => {
        console.log(`  - Deal ID: ${d.id} | Name: ${d.name} | Amount: ${d.amount} | Stage: ${d.stage?.name || 'N/A'}`);
      });

      const reassignments = await sequelize.models.DealReassignmentHistory.findAll({
        where: {
          [Op.or]: [{ oldOwnerId: eId }, { newOwnerId: eId }]
        }
      });
      console.log(`Reassignment History for ${emma.get("name")}: ${reassignments.length} records`);

      const chatMsgs = await sequelize.models.HandoffMessage.findAll({
        where: {
          [Op.or]: [{ senderId: eId }, { recipientId: eId }]
        }
      });
      console.log(`Handoff Chat Messages involving ${emma.get("name")}: ${chatMsgs.length} messages`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error inspecting Emma deals:", err);
    process.exit(1);
  }
}

checkEmmaDeals();
