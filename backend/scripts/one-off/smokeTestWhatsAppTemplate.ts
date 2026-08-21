/**
 * smokeTestWhatsAppTemplate.ts
 *
 * One-off post-approval smoke test for WhatsApp Business Content API templates.
 * Run ONCE manually after Meta approves both call_summary_ar and call_summary_en
 * and you have pasted the real HX... SIDs into the MessageTemplate rows via the
 * Master Data → Message Templates admin UI.
 *
 * Usage:
 *   npm run smoke:whatsapp-template -- +9665XXXXXXXX
 *
 * What it does:
 *   1. Confirms TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are set (not simulation mode).
 *   2. Confirms both call_summary_ar and call_summary_en have non-stub twilioContentSids.
 *   3. Sends a live test template message to the provided phone number for BOTH languages.
 *   4. Prints the Twilio Message SID + delivery status for each.
 */

import dotenv from "dotenv";
dotenv.config();

import twilio from "twilio";
import { sequelize } from "@nexus-crm/database";

// ─── Constants ────────────────────────────────────────────────────────────────

const STUB_PATTERN = /^HX_.*_stub$/;
const TEMPLATE_TRIGGER_EVENTS = ["call_summary_ar", "call_summary_en"] as const;

const TEST_VARIABLES: Record<string, string> = {
  "1": "Smoke Test Lead",
  "2": "This is an automated smoke test of the WhatsApp template integration",
  "3": "No action required — this was sent by the CRM smoke test script."
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(msg: string) {
  console.log(`  ✅  ${msg}`);
}

function fail(msg: string) {
  console.error(`  ❌  ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ️   ${msg}`);
}

function hr() {
  console.log("─".repeat(62));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const targetPhone = process.argv[2];
  if (!targetPhone || !targetPhone.startsWith("+")) {
    console.error("\nUsage: npm run smoke:whatsapp-template -- +9665XXXXXXXX\n");
    console.error("Phone number must start with '+' followed by country code.\n");
    process.exit(1);
  }

  console.log("\nNexus CRM — WhatsApp Template Smoke Test");
  hr();

  // ── Step 1: Verify Twilio credentials ────────────────────────────────────────
  info("Step 1: Checking Twilio credentials…");
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
  const twilioNumber = (
    process.env.TWILIO_WHATSAPP_NUMBER ??
    process.env.TWILIO_PHONE_NUMBER ??
    ""
  ).trim();

  if (!accountSid || !authToken) {
    fail("TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN are not set in .env — aborting.");
    fail("Set real credentials before running this script. DO NOT run in simulation mode.");
    process.exit(1);
  }

  if (accountSid.startsWith("AC_placeholder") || authToken === "placeholder") {
    fail("Credentials look like placeholders — aborting.");
    process.exit(1);
  }

  ok(`TWILIO_ACCOUNT_SID present (${accountSid.slice(0, 6)}…)`);
  ok(`TWILIO_AUTH_TOKEN present (${authToken.slice(0, 4)}…)`);
  ok(`Sender number: ${twilioNumber || "(will use default sandbox)"}`);
  hr();

  // ── Step 2: Confirm template rows have real SIDs ──────────────────────────────
  info("Step 2: Checking MessageTemplate rows in database…");
  await sequelize.authenticate();

  const errors: string[] = [];
  const templateRows: { triggerEvent: string; name: string; twilioContentSid: string; language: string }[] = [];

  for (const triggerEvent of TEMPLATE_TRIGGER_EVENTS) {
    const tmpl = await sequelize.models.MessageTemplate.findOne({
      where: { triggerEvent, isActive: true }
    }) as any;

    if (!tmpl) {
      errors.push(`Template row not found for triggerEvent='${triggerEvent}'. Run the backend to seed it first.`);
      continue;
    }

    const sid: string = tmpl.twilioContentSid ?? "";

    if (!sid) {
      errors.push(`'${triggerEvent}' (${tmpl.name}): twilioContentSid is empty — paste real HX… SID via Admin UI first.`);
      continue;
    }

    if (STUB_PATTERN.test(sid)) {
      errors.push(`'${triggerEvent}' (${tmpl.name}): twilioContentSid is still a stub value (${sid}) — replace with real HX… SID first.`);
      continue;
    }

    ok(`'${triggerEvent}' → Content SID: ${sid}`);
    templateRows.push({
      triggerEvent,
      name: tmpl.name,
      twilioContentSid: sid,
      language: tmpl.language ?? "ar"
    });
  }

  if (errors.length > 0) {
    hr();
    console.error("\nPre-flight check FAILED — fix the following before retrying:\n");
    errors.forEach(e => fail(e));
    console.log();
    process.exit(1);
  }

  hr();

  // ── Step 3: Send live test messages ──────────────────────────────────────────
  info(`Step 3: Sending live test template messages to ${targetPhone}…\n`);

  const client = twilio(accountSid, authToken);

  const twilioTo = targetPhone.startsWith("whatsapp:")
    ? targetPhone
    : `whatsapp:${targetPhone}`;
  const twilioFrom = twilioNumber.startsWith("whatsapp:")
    ? twilioNumber
    : `whatsapp:${twilioNumber || "+14155238886"}`;

  let allPassed = true;

  for (const tmpl of templateRows) {
    info(`Sending '${tmpl.triggerEvent}' (${tmpl.language.toUpperCase()}) → ${tmpl.twilioContentSid}`);
    try {
      const msg = await client.messages.create({
        from: twilioFrom,
        to: twilioTo,
        contentSid: tmpl.twilioContentSid,
        contentVariables: JSON.stringify(TEST_VARIABLES)
      });
      ok(`Message SID: ${msg.sid}  |  Status: ${msg.status}`);
    } catch (err: any) {
      fail(`Failed to send '${tmpl.triggerEvent}': ${err.message} (Twilio code: ${err.code ?? "unknown"})`);
      allPassed = false;
    }
    console.log();
  }

  hr();

  if (allPassed) {
    console.log(`\n🎉  Smoke test PASSED — both templates dispatched successfully.\n`);
    console.log(`   Check ${targetPhone} for the two WhatsApp messages.\n`);
    console.log(`   If they arrive correctly, the feature is ready for production rollout.\n`);
  } else {
    console.error(`\n⚠️   One or more sends failed — see errors above.\n`);
    console.error(`   Common causes:`);
    console.error(`     • Template not yet approved by Meta (submission pending)`);
    console.error(`     • Incorrect Content SID pasted into the Admin UI`);
    console.error(`     • Phone number not in E.164 format (e.g. +9665XXXXXXXX)\n`);
    process.exit(1);
  }

  await sequelize.close();
  process.exit(0);
}

main().catch(err => {
  console.error("\nUnhandled error:", err.message);
  process.exit(1);
});
