import { sequelize } from "@nexus-crm/database";

export function startExpiryScheduler() {
  // Run once immediately on startup
  checkExpiredQuotes();
  escalateUnactionedApprovals();
  checkOutstandingPOs();
  checkOverdueTasksAndSendDigests();

  // Then check every 24 hours
  setInterval(() => {
    checkExpiredQuotes();
    escalateUnactionedApprovals();
    checkOutstandingPOs();
    checkOverdueTasksAndSendDigests();
  }, 24 * 60 * 60 * 1000);
  console.log("Quote Expiry Scheduler service initialized.");
}

async function checkExpiredQuotes() {
  try {
    const { Op } = require("sequelize");
    console.log("Checking for expired quotes...");

    const updatedCount = await sequelize.models.Quote.update(
      { status: "Expired" },
      {
        where: {
          status: ["Draft", "Sent", "Viewed"], // Only active quote statuses
          expirationDate: {
            [Op.lt]: new Date()
          }
        }
      }
    );

    console.log(`Quote expiry check complete. Marked ${updatedCount[0]} quotes as Expired.`);
  } catch (error) {
    console.error("Error in Quote Expiry check:", error);
  }
}

async function escalateUnactionedApprovals() {
  try {
    const { Op } = require("sequelize");
    console.log("Checking for unactioned approvals to escalate...");

    const escapeTime = new Date();
    escapeTime.setHours(escapeTime.getHours() - 24); // 24 hours ago

    const pendingRequests = await sequelize.models.ApprovalRequest.findAll({
      where: {
        status: "Pending",
        createdAt: {
          [Op.lt]: escapeTime
        }
      }
    });

    const director = await sequelize.models.User.findOne({ where: { role: "director" } });
    const directorId = director ? (director as any).id : null;

    let escalatedCount = 0;
    for (const req of pendingRequests) {
      if (directorId && (req as any).assignedApproverId !== directorId) {
        await req.update({
          assignedApproverId: directorId,
          comments: `${(req as any).comments || ""} [ESCALATED] Escalated to director due to inactivity (>24h).`
        });
        escalatedCount++;
      }
    }

    console.log(`Approval escalation complete. Escalated ${escalatedCount} requests.`);
  } catch (error) {
    console.error("Error in Approval escalation check:", error);
  }
}

async function checkOutstandingPOs() {
  try {
    const { Op } = require("sequelize");
    console.log("Checking for outstanding POs...");

    const wonStage = await sequelize.models.PipelineStage.findOne({
      where: { name: "Won" }
    });
    if (!wonStage) return;

    const deals = await sequelize.models.Deal.findAll({
      where: { stageId: (wonStage as any).id },
      include: [
        {
          model: sequelize.models.Quote,
          as: "Quotes",
          where: { status: "Accepted" },
          include: [{ model: sequelize.models.PurchaseOrder, as: "PurchaseOrder", required: false }]
        },
        { model: sequelize.models.User, as: "owner" }
      ]
    });

    const followUpAge = new Date();
    followUpAge.setDate(followUpAge.getDate() - 7); // 7 days ago

    let alertedDealsCount = 0;
    for (const deal of deals) {
      const quotes = (deal as any).Quotes || [];
      for (const quote of quotes) {
        if (!quote.PurchaseOrder && new Date(quote.acceptedAt || quote.updatedAt) < followUpAge) {
          const existingActivity = await sequelize.models.Activity.findOne({
            where: {
              leadId: (deal as any).leadId || "00000000-0000-0000-0000-000000000000",
              type: "task",
              outcome: { [Op.like]: `%Outstanding PO follow-up for Quote%` }
            }
          });

          if (!existingActivity) {
            await sequelize.models.Activity.create({
              id: require('crypto').randomUUID(),
              leadId: (deal as any).leadId || "00000000-0000-0000-0000-000000000000",
              type: "task",
              dueDate: new Date(),
              priority: "high",
              outcome: `Outstanding PO follow-up for Quote ${(quote as any).quoteNumber}. Deal marked Won but no PO received.`,
              createdById: (deal as any).ownerId
            });
            alertedDealsCount++;
          }
        }
      }
    }

    console.log("Outstanding PO check complete. Created ${alertedDealsCount} follow-up tasks.");
  } catch (error) {
    console.error("Error in Outstanding PO follow-up check:", error);
  }
}

async function checkOverdueTasksAndSendDigests() {
  try {
    const { Op } = require("sequelize");
    console.log("Checking overdue tasks and generating daily task digests...");

    const users = await sequelize.models.User.findAll();
    for (const user of users) {
      const u = user as any;
      
      const tasks = await sequelize.models.Activity.findAll({
        where: {
          type: "task",
          isCompleted: false,
          createdById: u.id,
          dueDate: {
            [Op.lte]: new Date()
          }
        }
      });

      if (tasks.length > 0) {
        const overdue = tasks.filter((t: any) => new Date(t.dueDate) < new Date());
        const dueToday = tasks.filter((t: any) => new Date(t.dueDate) >= new Date());

        const digestBody = `
Daily Task Digest for ${u.name}
------------------------------
You have ${tasks.length} tasks needing attention today.

Overdue Tasks:
${overdue.map((t: any) => `- [${t.priority || 'medium'}] ${t.outcome} (Due: ${new Date(t.dueDate).toLocaleDateString()})`).join("\n")}

Tasks Due Today:
${dueToday.map((t: any) => `- [${t.priority || 'medium'}] ${t.outcome}`).join("\n")}

Please log in to your CRM to update your tasks.
        `;

        console.log(`\n--- DAILY TASK DIGEST EMAIL ---`);
        console.log(`To: ${u.email}`);
        console.log(`Subject: Daily Task Digest - ${tasks.length} Tasks Needing Attention`);
        console.log(`Body:\n${digestBody}`);
        console.log(`---------------------------------\n`);
      }
    }
  } catch (error) {
    console.error("Error in Overdue Tasks & Daily Digests check:", error);
  }
}
