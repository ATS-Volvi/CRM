import { processGmailConnector, processMetaConnector, processLinkedInConnector } from "./leadIngestion";

export function startConnectorScheduler() {
  if (process.env.NODE_ENV === "test") {
    console.log("[CONNECTOR SCHEDULER] Test environment detected. Skipping poller.");
    return;
  }

  console.log("[CONNECTOR SCHEDULER] Starting connector scheduler (polling every 2 minutes)...");

  setInterval(async () => {
    try {
      console.log("[CONNECTOR SCHEDULER] Running polled connectors...");
      await Promise.allSettled([
        processGmailConnector(),
        processMetaConnector(),
        processLinkedInConnector()
      ]);
    } catch (error) {
      console.error("[CONNECTOR SCHEDULER] Error in polled connectors:", error);
    }
  }, 2 * 60 * 1000);
}
