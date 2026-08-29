import { Request, Response } from "express";
import { checkOverdueTasks } from "../services/notificationService";
import { processScheduledEmails, processQuoteFollowUps } from "../services/emailService";
import { runPolledConnectors } from "../services/connectorScheduler";
import {
  checkExpiredQuotes,
  escalateUnactionedApprovals,
  checkOutstandingPOs,
  checkOverdueTasksAndSendDigests
} from "../services/expiryScheduler";
import { runTemperatureSweep } from "../services/temperatureScheduler";
import { checkAndSendWeeklyReport } from "../services/scheduledReportService";

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // If no secret configured, allow execution

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  if (req.query.key === cronSecret || req.query.secret === cronSecret) {
    return true;
  }
  return false;
}

export async function runHourlyCron(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized cron execution." });
    return;
  }

  const results: Record<string, any> = {};

  try {
    const overdueResult = await checkOverdueTasks().catch(err => ({ error: err.message }));
    const emailsResult = await processScheduledEmails().catch(err => ({ error: err.message }));
    const followUpsResult = await processQuoteFollowUps().catch(err => ({ error: err.message }));
    const connectorsResult = await runPolledConnectors().catch(err => ({ error: err.message }));

    results.checkOverdueTasks = overdueResult || "ok";
    results.processScheduledEmails = emailsResult || "ok";
    results.processQuoteFollowUps = followUpsResult || "ok";
    results.runPolledConnectors = connectorsResult || "ok";

    res.json({
      status: "success",
      type: "hourly",
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error("Hourly cron execution failure:", error);
    res.status(500).json({ error: error.message || "Internal cron error" });
  }
}

export async function runDailyCron(req: Request, res: Response): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized cron execution." });
    return;
  }

  const results: Record<string, any> = {};

  try {
    // 1. Task & Email checks
    const overdueResult = await checkOverdueTasks().catch(err => ({ error: err.message }));
    const emailsResult = await processScheduledEmails().catch(err => ({ error: err.message }));
    const followUpsResult = await processQuoteFollowUps().catch(err => ({ error: err.message }));
    const connectorsResult = await runPolledConnectors().catch(err => ({ error: err.message }));

    results.checkOverdueTasks = overdueResult || "ok";
    results.processScheduledEmails = emailsResult || "ok";
    results.processQuoteFollowUps = followUpsResult || "ok";
    results.runPolledConnectors = connectorsResult || "ok";

    // 2. Expirations, Escalations, POs & Reports
    await checkExpiredQuotes().catch(err => { results.checkExpiredQuotes = { error: err.message }; });
    await escalateUnactionedApprovals().catch(err => { results.escalateUnactionedApprovals = { error: err.message }; });
    await checkOutstandingPOs().catch(err => { results.checkOutstandingPOs = { error: err.message }; });
    await checkOverdueTasksAndSendDigests().catch(err => { results.checkOverdueTasksAndSendDigests = { error: err.message }; });
    await runTemperatureSweep().catch(err => { results.runTemperatureSweep = { error: err.message }; });
    await checkAndSendWeeklyReport().catch(err => { results.checkAndSendWeeklyReport = { error: err.message }; });

    res.json({
      status: "success",
      type: "daily",
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error("Daily cron execution failure:", error);
    res.status(500).json({ error: error.message || "Internal cron error" });
  }
}
