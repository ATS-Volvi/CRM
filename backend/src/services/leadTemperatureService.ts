import { sequelize } from "@nexus-crm/database";

/**
 * Calculates days between two dates.
 */
function getDaysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns hours between two dates.
 */
function getHoursDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return diffTime / (1000 * 60 * 60);
}



/**
 * Recalculates the responsiveness score for a given lead based on activity history.
 */
export async function recalculateResponsiveness(leadId: string): Promise<number> {
  const activities = await sequelize.models.Activity.findAll({
    where: { leadId },
    order: [["createdAt", "DESC"]],
  });

  const recentScores: number[] = [];
  let pendingInboundTime: Date | null = null;

  for (const act of activities) {
    const activity = act as any;
    
    const isInbound = activity.direction === "inbound";
    const isOutbound = activity.direction === "outbound";
    
    if (isInbound) {
      // Traverse backwards: an inbound reply starts the pair matching.
      // We overwrite to always use the earliest reply to a specific outbound message.
      pendingInboundTime = activity.createdAt;
    } else if (isOutbound) {
      if (pendingInboundTime) {
        // We matched an outbound message with a subsequent inbound reply
        const hoursDiff = getHoursDifference(activity.createdAt, pendingInboundTime);
        
        if (hoursDiff <= 1) {
          recentScores.push(15);
        } else if (hoursDiff <= 4) {
          recentScores.push(10);
        } else if (hoursDiff <= 24) {
          recentScores.push(5);
        } else {
          recentScores.push(0);
        }
        
        // Reset the pending inbound so we don't match this reply to an even older outbound message
        pendingInboundTime = null;

        // If we've collected our 5 most recent reply pairs, we stop.
        if (recentScores.length === 5) {
          break;
        }
      }
    }
  }

  // Calculate the average of the collected scores
  let responsivenessScore = 0;
  if (recentScores.length > 0) {
    const sum = recentScores.reduce((acc, val) => acc + val, 0);
    responsivenessScore = Math.round(sum / recentScores.length);
  }

  await sequelize.models.Lead.update(
    { responsivenessScore },
    { where: { id: leadId } }
  );

  return responsivenessScore;
}

/**
 * Calculates the decay penalty based on lastInboundAt.
 */
export function applyDecay(lead: any): number {
  if (!lead.lastInboundAt) return 0;
  
  const daysSinceInbound = getDaysDifference(new Date(lead.lastInboundAt), new Date());
  
  if (daysSinceInbound <= 3) return 0;
  if (daysSinceInbound <= 7) return -10;
  if (daysSinceInbound <= 14) return -25;
  return -999; // Represents forcing to Cold
}

/**
 * Updates the final temperature of a lead, saving to the database.
 */
export async function updateLeadTemperature(lead: any): Promise<void> {
  if (lead.temperatureOverride) return;

  const baseScore = lead.leadScore || 50;
  const responsiveness = lead.responsivenessScore || 0;
  const decay = applyDecay(lead);
  
  let newTemperature = "Warm";
  
  if (decay === -999) {
    newTemperature = "Cold";
  } else {
    const finalScore = baseScore + responsiveness + decay;
    if (finalScore >= 80) newTemperature = "Hot";
    else if (finalScore >= 50) newTemperature = "Warm";
    else newTemperature = "Cold";
  }

  if (lead.temperature !== newTemperature) {
    lead.temperature = newTemperature;
    await lead.save();
  }
}

/**
 * Called whenever a new inbound activity is registered for a lead.
 */
export async function handleInboundActivity(leadId: string): Promise<void> {
  const lead = await sequelize.models.Lead.findByPk(leadId);
  if (!lead) return;

  // Update last inbound timestamp
  (lead as any).lastInboundAt = new Date();
  await lead.save();

  // Recalculate everything
  await recalculateResponsiveness(leadId);
  
  // Reload lead to get updated responsivenessScore
  await lead.reload();
  await updateLeadTemperature(lead);
}
