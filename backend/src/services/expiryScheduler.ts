import { sequelize } from "@nexus-crm/database";

export function startExpiryScheduler() {
  // Run once immediately on startup
  checkExpiredQuotes();

  // Then check every 24 hours
  setInterval(checkExpiredQuotes, 24 * 60 * 60 * 1000);
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
