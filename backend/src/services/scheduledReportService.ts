import { calculateTeamKpis } from "./kpiService";

export function startReportScheduler() {
  // Check and run report every Monday morning (we will check every 24 hours)
  setInterval(checkAndSendWeeklyReport, 24 * 60 * 60 * 1000);
  console.log("Weekly Scheduled Report service initialized.");
}

async function checkAndSendWeeklyReport() {
  try {
    const today = new Date();
    // Monday is day 1
    if (today.getDay() !== 1) return; 

    console.log("Generating weekly dashboard snapshot report...");
    const stats = await calculateTeamKpis();

    if (!stats) return;

    // Build plain text snapshot (or HTML)
    const reportText = `
Weekly Nexus CRM Executive Summary
-----------------------------------
Generated on: ${today.toLocaleDateString()}

Key Metrics:
- Total Active Pipeline Value: $${stats.totalPipelineValue.toLocaleString()}
- Total Closed-Won Revenue: $${stats.totalWonAmount.toLocaleString()}
- Average Team Win-Rate: ${stats.teamCloseRate}%
- Active Deals Under Management: ${stats.activeDealsCount}

Have a successful sales week!
    `;

    console.log(reportText);
    // In a production setup, this would invoke nodemailer:
    // await sendSystemEmail("executive-director@nexus.com", "Weekly Executive Snapshot", reportText);
    
  } catch (error) {
    console.error("Weekly scheduled report error:", error);
  }
}
