import { sequelize, Activity } from "@nexus-crm/database";

function isInboundActivity(activity: any): boolean {
  if (activity.outcome === "message received") return true;
  if (activity.outcome === "received") return true; // Instagram
  if (activity.outcome && activity.outcome.includes("Duplicate lead capture")) return true;
  if (activity.outcome && activity.outcome.includes("Email received")) return true;
  return false;
}

function isOutboundActivity(activity: any): boolean {
  const isInbound = isInboundActivity(activity);
  return !isInbound && activity.createdById !== null;
}

async function runBackfill() {
  await sequelize.authenticate();
  const activities = await Activity.findAll({ where: { direction: null } });
  console.log(`Found ${activities.length} activities to backfill.`);
  
  let inboundCount = 0;
  let outboundCount = 0;
  let internalCount = 0;

  for (const activity of activities) {
    let dir = "internal";
    if (isInboundActivity(activity)) {
      dir = "inbound";
      inboundCount++;
    } else if (isOutboundActivity(activity)) {
      dir = "outbound";
      outboundCount++;
    } else {
      internalCount++;
    }
    await sequelize.query(`UPDATE "Activities" SET direction = '${dir}' WHERE id = '${activity.id}'`);
  }

  console.log("Backfill complete via raw SQL updates!");
  console.log(`Inbound: ${inboundCount}`);
  console.log(`Outbound: ${outboundCount}`);
  console.log(`Internal: ${internalCount}`);
  
  const result = await sequelize.query(`SELECT direction, COUNT(*) FROM "Activities" GROUP BY direction`);
  console.log("--- RAW DATABASE COUNTS ---");
  console.log(result[0]);
  process.exit(0);
}
runBackfill().catch(console.error);
