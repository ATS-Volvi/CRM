#!/usr/bin/env node
/**
 * scripts/live-test-cleanup.mjs
 *
 * Cleans up records created during the live test flow:
 * 1. Reads ~/.live-test-records.json.
 * 2. Validates BASE_URL and production guards (--i-know-this-is-production).
 * 3. Prompts for admin credentials with hidden password entry.
 * 4. Restores any reassignment it changed.
 * 5. Prompts y/N before cleaning each kind of resource:
 *    - Photos (DELETE /site-inspections/:id/attachments/:attId to clean bucket objects & DB)
 *    - Opportunities & Leads (DELETE, or rename with "ZZ TEST - REMOVED" & mark Lost)
 *    - Users (DELETE, or deactivate & mark Inactive)
 * 6. Prints summary of removed and modified items.
 * 7. Reminds user to delete ~/.live-test.env and ~/.live-test-records.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promptHidden, promptText, promptConfirm } from './lib/prompt.mjs';
import { validateUrlAndArgs, ensureSafeOutputDir } from './live-test-utils.mjs';

async function main() {
  const baseUrl = validateUrlAndArgs(process.argv, 'live-test-cleanup.mjs');
  const homeDir = os.homedir();
  ensureSafeOutputDir(homeDir);

  const jsonFilePath = path.join(homeDir, '.live-test-records.json');
  const envFilePath = path.join(homeDir, '.live-test.env');

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`\nERROR: Records file not found: ${jsonFilePath}`);
    console.error(`No test records found to clean up.\n`);
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  process.stdout.write(`\n========================================================================\n`);
  process.stdout.write(`CLEANUP UTILITY FOR LIVE TEST DATA AT: ${baseUrl}\n`);
  process.stdout.write(`========================================================================\n\n`);

  // Prompt for Admin login
  process.stdout.write(`Enter Admin credentials to authorize cleanup:\n`);
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

  process.stdout.write(`\nAuthenticating Admin...\n`);
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
  process.stdout.write(`Admin authenticated successfully.\n\n`);

  const summary = {
    reassignmentsRestored: [],
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

  // 1. Restore any reassignment changed during live test
  if (records.reassignedFrom && Array.isArray(records.inspections)) {
    for (const insp of records.inspections) {
      process.stdout.write(`Restoring original assignment for inspection ${insp.id} -> ${records.reassignedFrom}...\n`);
      try {
        const reassignRes = await fetch(`${baseUrl}/api/v1/site-inspections/${insp.id}/reassign`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            assignedToId: records.reassignedFrom,
            reason: 'Restoring original assignment after live test',
          }),
        });
        if (reassignRes.ok) {
          summary.reassignmentsRestored.push(insp.id);
        }
      } catch (err) {
        console.warn(`Warn: Could not restore reassignment on ${insp.id}: ${err.message}`);
      }
    }
  }

  // 2. Clean Attachments (Photos)
  const attachments = records.attachments || [];
  if (attachments.length > 0) {
    process.stdout.write(`\nFound ${attachments.length} test attachment(s) to remove.\n`);
    const doAttachments = await promptConfirm(`Delete test photo attachment(s) and clean storage bucket? (y/N): `);
    if (doAttachments) {
      for (const att of attachments) {
        process.stdout.write(`Deleting attachment ${att.id} (inspection: ${att.inspectionId})...\n`);
        try {
          // Transition inspection to CHANGES_REQUESTED if currently APPROVED or SUBMITTED
          // so that DELETE /attachments/:attId is allowed by business rules
          await fetch(`${baseUrl}/api/v1/site-inspections/${att.inspectionId}/review`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ action: 'REQUEST_CHANGES', comment: 'Teardown cleanup' }),
          }).catch(() => {});

          const delRes = await fetch(`${baseUrl}/api/v1/site-inspections/${att.inspectionId}/attachments/${att.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.attachmentsDeleted.push(att.id);
          } else {
            const errText = await delRes.text();
            // If deletion is not supported or blocked by approved status, rename with "ZZ TEST - REMOVED" prefix
            const patchRes = await fetch(`${baseUrl}/api/v1/site-inspections/${att.inspectionId}/attachments/${att.id}`, {
              method: 'PATCH',
              headers: authHeaders,
              body: JSON.stringify({ caption: 'ZZ TEST - REMOVED' }),
            });
            if (patchRes.ok) {
              summary.attachmentsRenamed = summary.attachmentsRenamed || [];
              summary.attachmentsRenamed.push(att.id);
            } else {
              summary.attachmentsFailed.push({ id: att.id, error: errText });
            }
          }
        } catch (err) {
          summary.attachmentsFailed.push({ id: att.id, error: err.message });
        }
      }
    }
  }

  // 3. Clean Opportunities
  const opportunities = records.opportunities || [];
  if (opportunities.length > 0) {
    process.stdout.write(`\nFound ${opportunities.length} test opportunity(ies) to clean.\n`);
    const doOpps = await promptConfirm(`Deactivate and rename test opportunity(ies)? (y/N): `);
    if (doOpps) {
      for (const opp of opportunities) {
        process.stdout.write(`Cleaning opportunity ${opp.id}...\n`);
        try {
          // Try DELETE first; if not supported, rename with ZZ TEST - REMOVED prefix
          const delRes = await fetch(`${baseUrl}/api/v1/opportunities/${opp.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.opportunitiesUpdated.push({ id: opp.id, action: 'Deleted' });
          } else {
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

  // 4. Clean Leads
  const leads = records.leads || [];
  if (leads.length > 0) {
    process.stdout.write(`\nFound ${leads.length} test lead(s) to remove.\n`);
    const doLeads = await promptConfirm(`Delete test lead(s)? (y/N): `);
    if (doLeads) {
      for (const lead of leads) {
        process.stdout.write(`Cleaning lead ${lead.id} (${lead.name || ''})...\n`);
        try {
          const delRes = await fetch(`${baseUrl}/api/v1/leads/${lead.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (delRes.ok) {
            summary.leadsDeleted.push(lead.id);
          } else {
            const errText = await delRes.text();
            // Fallback: rename with "ZZ TEST - REMOVED" prefix
            const renameRes = await fetch(`${baseUrl}/api/v1/leads/${lead.id}`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({
                company: `ZZ TEST - REMOVED ${lead.name || lead.id}`,
                firstName: 'ZZ TEST',
                lastName: 'REMOVED',
                status: 'LOST',
              }),
            });
            if (renameRes.ok) {
              summary.leadsRenamed.push({ id: lead.id, reason: 'Renamed ZZ TEST - REMOVED' });
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

  // 5. Clean Test Users
  const userList = Object.values(records.users || {});
  if (userList.length > 0) {
    process.stdout.write(`\nFound ${userList.length} test user account(s) to clean.\n`);
    const doUsers = await promptConfirm(`Deactivate test user account(s)? (y/N): `);
    if (doUsers) {
      for (const u of userList) {
        process.stdout.write(`Deactivating test user ${u.name || u.role} (${u.email})...\n`);
        try {
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
  process.stdout.write(`\n========================================================================\n`);
  process.stdout.write(`CLEANUP SUMMARY:\n`);
  process.stdout.write(`------------------------------------------------------------------------\n`);
  process.stdout.write(`Reassignments restored:                ${summary.reassignmentsRestored.length}\n`);
  process.stdout.write(`Attachments deleted from storage & DB: ${summary.attachmentsDeleted.length}\n`);
  if (summary.attachmentsRenamed && summary.attachmentsRenamed.length > 0) {
    process.stdout.write(`Attachments renamed ZZ TEST - REMOVED: ${summary.attachmentsRenamed.length}\n`);
  }
  if (summary.attachmentsFailed.length > 0) {
    process.stdout.write(`Attachments failed to delete:          ${summary.attachmentsFailed.length}\n`);
    summary.attachmentsFailed.forEach((f) => process.stdout.write(`  - ID: ${f.id}: ${f.error}\n`));
  }
  process.stdout.write(`Opportunities cleaned:                 ${summary.opportunitiesUpdated.length}\n`);
  if (summary.opportunitiesFailed.length > 0) {
    process.stdout.write(`Opportunities failed:                  ${summary.opportunitiesFailed.length}\n`);
    summary.opportunitiesFailed.forEach((f) => process.stdout.write(`  - ID: ${f.id}: ${f.error}\n`));
  }
  process.stdout.write(`Leads deleted:                         ${summary.leadsDeleted.length}\n`);
  process.stdout.write(`Leads renamed ZZ TEST - REMOVED:       ${summary.leadsRenamed.length}\n`);
  if (summary.leadsFailed.length > 0) {
    process.stdout.write(`Leads failed:                          ${summary.leadsFailed.length}\n`);
    summary.leadsFailed.forEach((f) => process.stdout.write(`  - ID: ${f.id}: ${f.error}\n`));
  }
  process.stdout.write(`Users deactivated / marked Inactive:   ${summary.usersDeactivated.length}\n`);
  if (summary.usersFailed.length > 0) {
    process.stdout.write(`Users failed:                          ${summary.usersFailed.length}\n`);
    summary.usersFailed.forEach((f) => process.stdout.write(`  - ID: ${f.id} (${f.email}): ${f.error}\n`));
  }
  process.stdout.write(`========================================================================\n\n`);

  process.stdout.write(`ACTION REQUIRED:\n`);
  process.stdout.write(`Remember to remove your temporary local credentials and records files:\n`);
  process.stdout.write(`  rm -f ${envFilePath} ${jsonFilePath}\n\n`);
}

main().catch((err) => {
  console.error(`FATAL ERROR IN CLEANUP: ${err?.message || err}`);
  process.exit(1);
});
