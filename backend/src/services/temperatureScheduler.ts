import { sequelize } from "@nexus-crm/database";
import { applyDecay, updateLeadTemperature } from "./leadTemperatureService";

export function startTemperatureScheduler() {
  // Run once immediately on startup, but with a slight delay to ensure DB connection is fully ready
  setTimeout(() => {
    runTemperatureSweep();
  }, 10000);

  // Then check every 24 hours
  setInterval(() => {
    runTemperatureSweep();
  }, 24 * 60 * 60 * 1000);
  console.log("Lead Temperature Scheduler service initialized.");
}

export async function runTemperatureSweep() {
  try {
    const { Op } = require("sequelize");
    console.log("Running daily lead temperature decay sweep...");

    // Find all active leads
    const leads = await sequelize.models.Lead.findAll({
      where: {
        status: {
          [Op.notIn]: ["Closed - Won", "Closed - Lost", "Disqualified", "Archived"]
        },
        temperatureOverride: false // Skip leads with a manual override
      }
    });

    let updatedCount = 0;
    for (const lead of leads) {
      const oldTemp = (lead as any).temperature;
      await updateLeadTemperature(lead);
      if ((lead as any).temperature !== oldTemp) {
        updatedCount++;
      }
    }

    console.log(`Lead temperature sweep complete. Updated ${updatedCount} leads.`);
  } catch (error) {
    console.error("Error in Lead Temperature sweep:", error);
  }
}
