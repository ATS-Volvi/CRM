#!/usr/bin/env node
/**
 * scripts/live-test-cleanup.mjs
 *
 * Cleans up records created during the live test flow:
 * 1. Reads ~/.live-test-records.json.
 * 2. Validates BASE_URL and production guards.
 * 3. Prompts for admin credentials on /dev/tty with hidden password entry.
 * 4. Logs in as admin via POST /api/v1/auth/login.
 * 5. Prompts y/N before cleaning each kind of resource:
 *    - Attachments (deleted via DELETE /site-inspections/:id/attachments/:attId to clean bucket objects)
 *    - Opportunities (renamed with "ZZ TEST - REMOVED" prefix and marked Lost)
 *    - Leads (deleted via DELETE /leads/:id)
 *    - Users (deactivated via PUT /settings/availability)
 * 6. Prints summary of removed and modified items.
 * 7. Reminds user to delete ~/.live-test.env and ~/.live-test-records.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateUrlAndArgs,
  ensureSafeOutputDir,
  promptHidden,
  promptText,
  promptConfirm,
} from './live-test-utils.mjs';

async function main() {
  const baseUrl = validateUrlAndArgs(process.argv, 'live-test-cleanup.mjs');
  const homeDir = os.homedir();
  ensureSafeOutputDir(homeDir);

  const jsonFilePath = path.join(homeDir, '.live-test-records.json');
  const envFilePath = path.join(homeDir, '.live-test.env');

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`ERROR: Records file not found: ${jsonFilePath}`);
    console.error(`No test records found to clean up.`);
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  console.log(`\n========================================================================`);
  console.log(`CLEANUP UTILITY FOR LIVE TEST DATA AT: ${baseUrl}`);
  console.log(`========================================================================\n`);

  // Prompt for Admin login
  console.log(`Enter Admin credentials to authorize cleanup:`);
  const adminEmail = await promptText(`Admin Email: `, 'ADMIN_EMAIL');
  if (!adminEmail) {
    console.error(`ERROR: Admin email cannot be empty.`);
    process.exit(1);
  }
  const adminPassword = await promptHidden(`Admin Password: `, 'ADMIN_PASSWORD');
  if (!adminPassword) {
    console.error(`ERROR: Admin password cannot be empty.`);
    process.exit(1);
  }

  console.log(`\nAuthenticating Admin...`);
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!loginRes.ok) {
    console.error(`ERROR: Admin login failed (HTTP ${loginRes.status}): ${await loginRes.text()}`);
    process.exit(1);
  }

  const { token: adminToken } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };
  console.log(`Admin authenticated successfully.\n`);

  const summary = {
    attachmentsDeleted: [],
    attachmentsFailed: [],
    opportunitiesUpdated: [],
    opportunitiesFailed: [],
    leadsDeleted: [],
    leadsRenamed: [],
    leadsFailed: [],
    usersDeactivated: [],
    usersFailed: [],
  };

  // 1. Clean Attachments
  const attachments = records.attachments || [];
  if (attachments.length > 0) {
    console.log(`Found ${attachments.length} test attachment(s) to remove.`);
    const doAttachments = await promptConfirm(`Delete test photo attachment(s) and clean storage bucket? (y/N): `);
    if (doAttachments) {
      for (const att of attachments) {
        console.log(`Deleting attachment ${att.id} (inspection: ${att.inspectionId})...`);
        try {
          // Transition inspection to CHANGES_REQUESTED if currently APPROVED or SUBMITTED
          // so that DELETE /attachments/:attId is allowed by business rules
          await fetch(`${baseUrl}/api/v1/site-inspections/${att.inspectionId}/review`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ action: 'CHANGES_REQUESTED', comment: 'Teardown cleanup' }),
          }).catch(() => {});

          const delRes = await fetch(`${baseUrl}/api/v1/site-inspections/${att.inspectionId}/attachments/${att.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.attachmentsDeleted.push(att.id);
          } else {
            summary.attachmentsFailed.push({ id: att.id, error: await delRes.text() });
          }
        } catch (err) {
          summary.attachmentsFailed.push({ id: att.id, error: err.message });
        }
      }
    }
  }

  // 2. Clean Opportunities
  const opportunities = records.opportunities || [];
  if (opportunities.length > 0) {
    console.log(`\nFound ${opportunities.length} test opportunity(ies) to clean.`);
    const doOpps = await promptConfirm(`Deactivate and rename test opportunity(ies)? (y/N): `);
    if (doOpps) {
      for (const opp of opportunities) {
        console.log(`Deactivating opportunity ${opp.id}...`);
        try {
          // Try DELETE first; if not supported (HTTP 404), rename with ZZ TEST - REMOVED prefix
          const delRes = await fetch(`${baseUrl}/api/v1/opportunities/${opp.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.opportunitiesUpdated.push({ id: opp.id, action: 'Deleted' });
          } else {
            // Deactivate and prefix name
            const patchRes = await fetch(`${baseUrl}/api/v1/opportunities/${opp.id}`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({
                name: `ZZ TEST - REMOVED ${opp.name || opp.id}`,
                status: 'Lost',
                lossReason: 'Test teardown cleanup',
              }),
            });
            if (patchRes.ok) {
              summary.opportunitiesUpdated.push({ id: opp.id, action: 'Renamed ZZ TEST - REMOVED & marked Lost' });
            } else {
              summary.opportunitiesFailed.push({ id: opp.id, error: await patchRes.text() });
            }
          }
        } catch (err) {
          summary.opportunitiesFailed.push({ id: opp.id, error: err.message });
        }
      }
    }
  }

  // 3. Clean Leads
  const leads = records.leads || [];
  if (leads.length > 0) {
    console.log(`\nFound ${leads.length} test lead(s) to remove.`);
    const doLeads = await promptConfirm(`Delete / Deactivate test lead(s)? (y/N): `);
    if (doLeads) {
      for (const lead of leads) {
        console.log(`Cleaning lead ${lead.id}...`);
        try {
          const delRes = await fetch(`${baseUrl}/api/v1/leads/${lead.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
          if (delRes.ok) {
            summary.leadsDeleted.push(lead.id);
          } else {
            const errText = await delRes.text();
            // Fallback: If deletion is blocked (e.g. FK constraint), rename with ZZ TEST - REMOVED prefix
            const renameRes = await fetch(`${baseUrl}/api/v1/leads/${lead.id}`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({
                firstName: 'ZZ TEST - REMOVED',
                lastName: 'REMOVED',
                company: 'ZZ TEST - REMOVED',
              }),
            });
            if (renameRes.ok) {
              summary.leadsRenamed.push({ id: lead.id, reason: 'Renamed ZZ TEST - REMOVED (deletion prevented by linked records)' });
            } else {
              summary.leadsFailed.push({ id: lead.id, error: errText });
            }
          }
        } catch (err) {
          summary.leadsFailed.push({ id: lead.id, error: err.message });
        }
      }
    }
  }

  // 4. Clean Users
  const userList = Object.values(records.users || {});
  if (userList.length > 0) {
    console.log(`\nFound ${userList.length} test user account(s) to clean.`);
    const doUsers = await promptConfirm(`Deactivate test user account(s)? (y/N): `);
    if (doUsers) {
      for (const u of userList) {
        console.log(`Deactivating test user ${u.name} (${u.email})...`);
        try {
          // Try DELETE first; if not supported, deactivate availability
          const delRes = await fetch(`${baseUrl}/api/v1/users/${u.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.usersDeactivated.push({ id: u.id, email: u.email, action: 'Deleted' });
          } else {
            const deactRes = await fetch(`${baseUrl}/api/v1/settings/availability`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({
                userId: u.id,
                isAvailable: false,
                onLeave: true,
                status: 'Inactive',
              }),
            });
            if (deactRes.ok) {
              summary.usersDeactivated.push({ id: u.id, email: u.email, action: 'Deactivated (Inactive)' });
            } else {
              summary.usersFailed.push({ id: u.id, email: u.email, error: await deactRes.text() });
            }
          }
        } catch (err) {
          summary.usersFailed.push({ id: u.id, email: u.email, error: err.message });
        }
      }
    }
  }

  // Summary Report
  console.log(`\n========================================================================`);
  console.log(`CLEANUP SUMMARY:`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`Attachments deleted from storage & DB: ${summary.attachmentsDeleted.length}`);
  if (summary.attachmentsFailed.length > 0) {
    console.log(`Attachments failed to delete: ${summary.attachmentsFailed.length}`);
    summary.attachmentsFailed.forEach((f) => console.log(`  - ID: ${f.id}: ${f.error}`));
  }

  console.log(`Opportunities updated / deactivated:   ${summary.opportunitiesUpdated.length}`);
  if (summary.opportunitiesFailed.length > 0) {
    console.log(`Opportunities failed: ${summary.opportunitiesFailed.length}`);
    summary.opportunitiesFailed.forEach((f) => console.log(`  - ID: ${f.id}: ${f.error}`));
  }

  console.log(`Leads deleted:                         ${summary.leadsDeleted.length}`);
  console.log(`Leads deactivated / renamed:           ${summary.leadsRenamed.length}`);
  if (summary.leadsRenamed.length > 0) {
    summary.leadsRenamed.forEach((r) => console.log(`  - ID: ${r.id} (${r.reason})`));
  }
  if (summary.leadsFailed.length > 0) {
    console.log(`Leads failed:                          ${summary.leadsFailed.length}`);
    summary.leadsFailed.forEach((f) => console.log(`  - ID: ${f.id}: ${f.error}`));
  }

  console.log(`Users deactivated / marked Inactive:   ${summary.usersDeactivated.length}`);
  if (summary.usersFailed.length > 0) {
    console.log(`Users failed: ${summary.usersFailed.length}`);
    summary.usersFailed.forEach((f) => console.log(`  - ID: ${f.id} (${f.email}): ${f.error}`));
  }

  console.log(`========================================================================`);
  console.log(`\nACTION REQUIRED:`);
  console.log(`Remember to remove your temporary local credentials and records files:`);
  console.log(`  rm -f ${envFilePath} ${jsonFilePath}\n`);
}

main().catch((err) => {
  console.error(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
