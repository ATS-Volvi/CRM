import { sequelize } from '@nexus-crm/database';
import { Op } from 'sequelize';
import { runClaimedMessage } from './campaignMessageService';
import { createNotification } from './notificationEngine';

let isTickRunning = false;

export function getCampaignScheduleGraceMinutes(): number {
  const parsed = parseInt(process.env.CAMPAIGN_SCHEDULE_GRACE_MINUTES || '60', 10);
  return isNaN(parsed) || parsed < 0 ? 60 : parsed;
}

/**
 * Scheduled Campaign Message Processor
 * Runs every minute, finds messages with status SCHEDULED and scheduledAt <= now,
 * and atomically claims each one so two server instances cannot both send it.
 */
export async function processScheduledCampaignMessages() {
  if (isTickRunning) {
    return;
  }
  isTickRunning = true;

  try {
    if (!sequelize.models.CampaignMessage) return;

    const now = new Date();
    const scheduledMessages = (await sequelize.models.CampaignMessage.findAll({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { [Op.lte]: now }
      }
    })) as any[];

    if (!scheduledMessages || scheduledMessages.length === 0) return;

    const graceMinutes = getCampaignScheduleGraceMinutes();
    const graceMs = graceMinutes * 60 * 1000;

    for (const msg of scheduledMessages) {
      try {
        const scheduledTime = new Date(msg.scheduledAt).getTime();
        const isOverdue = now.getTime() - scheduledTime > graceMs;

        if (isOverdue) {
          // Missed grace window while server was offline: return to DRAFT and notify creator
          msg.status = 'DRAFT';
          msg.scheduledAt = null;
          await msg.save();

          if (msg.createdBy) {
            try {
              await createNotification({
                userId: msg.createdBy,
                type: 'CAMPAIGN_SCHEDULE_MISSED',
                severity: 'WARNING',
                title: 'Scheduled Campaign Send Missed',
                message: 'Scheduled send was missed while the server was offline; please reschedule.',
                entityType: 'CAMPAIGN',
                entityId: msg.campaignId,
                source: 'CAMPAIGN_SCHEDULER'
              });
            } catch (notifyErr: any) {
              console.error(`[CampaignMessageScheduler] Failed to dispatch notification for missed message ${msg.id}: ${notifyErr.message || notifyErr}`);
            }
          }
          continue;
        }

        // ATOMIC CLAIM: Update status from SCHEDULED -> SENDING where id = msg.id AND status = 'SCHEDULED'
        const [claimedRows] = await sequelize.models.CampaignMessage.update(
          { status: 'SENDING' },
          {
            where: {
              id: msg.id,
              status: 'SCHEDULED'
            }
          }
        );

        if (claimedRows === 0) {
          // Another instance/worker already claimed this message
          continue;
        }

        console.log(`[CampaignMessageScheduler] Atomically claimed scheduled message ${msg.id} for campaign ${msg.campaignId}`);

        try {
          await runClaimedMessage(msg.campaignId, msg.id);
        } catch (err: any) {
          console.error(`[CampaignMessageScheduler] Error processing scheduled message ${msg.id}: ${err.message || err}`);
          const current = (await sequelize.models.CampaignMessage.findByPk(msg.id)) as any;
          if (current && current.status === 'SENDING') {
            current.status = 'FAILED';
            await current.save();
          }
        }
      } catch (msgErr: any) {
        console.error(`[CampaignMessageScheduler] Error handling scheduled message ${msg.id}: ${msgErr.message || msgErr}`);
      }
    }
  } catch (error: any) {
    console.error('[CampaignMessageScheduler] Error in processScheduledCampaignMessages:', error.message || error);
  } finally {
    isTickRunning = false;
  }
}

/**
 * Starts the interval timer for scheduled campaign messages (runs every minute).
 */
export function startCampaignMessageScheduler() {
  console.log("[CampaignMessageScheduler] started, polling every 60s");
  // Run once immediately on startup
  processScheduledCampaignMessages().catch((err: any) => {
    console.error('[CampaignMessageScheduler] Startup error:', err.message || err);
  });

  // Check every 60 seconds
  setInterval(() => {
    processScheduledCampaignMessages().catch((err: any) => {
      console.error('[CampaignMessageScheduler] Interval error:', err.message || err);
    });
  }, 60 * 1000);

  console.log('Campaign Message Scheduler initialized (interval: 60s).');
}
