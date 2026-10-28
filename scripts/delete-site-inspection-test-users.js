#!/usr/bin/env node
/**
 * scripts/delete-site-inspection-test-users.js
 *
 * Cleanup script:
 *   - Reads ~/.site-inspection-test-users.json
 *   - Logs in as admin via PREVIEW_URL HTTP API
 *   - Deactivates the created test users (marks Inactive / isAvailable: false)
 *   - Lists leads and inspections created during test runs (from /tmp/site-inspection-preview-records.json)
 *   - Prompts for confirmation before deleting each kind
 *
 * Does not run automatically.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function isPlaceholder(val) {
  if (!val) return true;
  return /YOUR|\.\.\.|<|>|YOUR-REAL|paste preview|example\.com/i.test(val);
}

async function main() {
  const PREVIEW_URL = process.env.PREVIEW_URL;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const VERCEL_BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

  const missing = [];
  if (!PREVIEW_URL) missing.push('PREVIEW_URL');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  const baseUrl = PREVIEW_URL.replace(/\/+$/, '');
  if (isPlaceholder(baseUrl)) {
    console.error(`ERROR: PREVIEW_URL contains a placeholder: "${baseUrl}".`);
    process.exit(1);
  }

  const homeDir = os.homedir();
  const jsonFilePath = path.join(homeDir, '.site-inspection-test-users.json');
  const envFilePath = path.join(homeDir, '.site-inspection-test.env');
  const recordsFilePath = '/tmp/site-inspection-preview-records.json';

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`ERROR: Metadata file not found at ${jsonFilePath}. No test users recorded.`);
    process.exit(1);
  }

  const userData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  const defaultHeaders = { 'Content-Type': 'application/json' };
  if (VERCEL_BYPASS_TOKEN) {
    defaultHeaders['x-vercel-protection-bypass'] = VERCEL_BYPASS_TOKEN;
  }

  // 1. Authenticate as Admin
  console.log(`Connecting to ${baseUrl}...`);
  console.log(`Authenticating as Admin...`);
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error(`ERROR: Admin login failed (HTTP ${loginRes.status}): ${await loginRes.text()}`);
    process.exit(1);
  }

  const { token: adminToken } = await loginRes.json();
  console.log(`Admin authenticated.`);

  const authHeaders = {
    ...defaultHeaders,
    Authorization: `Bearer ${adminToken}`,
  };

  // 2. Deactivate test users
  const targetUsers = [userData.siteManager, userData.opsManager, userData.salesRep].filter(Boolean);

  console.log(`\nFound ${targetUsers.length} test user(s) to deactivate:`);
  targetUsers.forEach((u) => {
    console.log(`  - ${u.name} (${u.email}) [ID: ${u.id}]`);
  });

  const confirmUsers = await askQuestion(`\nDeactivate these test users now? (y/N): `);
  if (confirmUsers.toLowerCase() === 'y' || confirmUsers.toLowerCase() === 'yes') {
    for (const u of targetUsers) {
      console.log(`Deactivating ${u.email}...`);
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
        console.log(`  [OK] ${u.email} deactivated.`);
      } else {
        console.warn(`  [WARN] Failed to deactivate via /settings/availability (${deactRes.status})`);
      }
    }
  } else {
    console.log('Skipping user deactivation.');
  }

  // 3. Check for created test records
  if (fs.existsSync(recordsFilePath)) {
    try {
      const records = JSON.parse(fs.readFileSync(recordsFilePath, 'utf8'));
      console.log(`\n======================================================`);
      console.log(`RECORDED TEST ARTIFACTS:`);
      console.log(`Lead Title:        ${records.leadTitle || 'N/A'}`);
      console.log(`Lead ID:           ${records.leadId || 'N/A'}`);
      console.log(`Lead Number:       ${records.leadNumber || 'N/A'}`);
      console.log(`Inspection ID:     ${records.inspectionId || 'N/A'}`);
      console.log(`Inspection Number: ${records.inspectionNumber || 'N/A'}`);
      console.log(`Attachments:       ${(records.attachments || []).length} recorded`);
      console.log(`======================================================\n`);

      // Delete attachments if any
      if (records.inspectionId && records.attachments && records.attachments.length > 0) {
        const confirmAtts = await askQuestion(`Delete ${(records.attachments || []).length} inspection attachment(s)? (y/N): `);
        if (confirmAtts.toLowerCase() === 'y' || confirmAtts.toLowerCase() === 'yes') {
          for (const att of records.attachments) {
            console.log(`Deleting attachment ${att.id} (${att.fileName})...`);
            const delAttRes = await fetch(`${baseUrl}/api/v1/site-inspections/${records.inspectionId}/attachments/${att.id}`, {
              method: 'DELETE',
              headers: authHeaders,
            });
            console.log(`  HTTP ${delAttRes.status}`);
          }
        }
      }

      // Delete lead if recorded
      if (records.leadId) {
        const confirmLead = await askQuestion(`Delete test lead ${records.leadId} (${records.leadTitle})? (y/N): `);
        if (confirmLead.toLowerCase() === 'y' || confirmLead.toLowerCase() === 'yes') {
          console.log(`Deleting lead ${records.leadId}...`);
          const delLeadRes = await fetch(`${baseUrl}/api/v1/leads/${records.leadId}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
          if (delLeadRes.ok) {
            console.log(`  [OK] Lead deleted.`);
          } else {
            console.warn(`  [WARN] Failed to delete lead (${delLeadRes.status}): ${await delLeadRes.text()}`);
          }
        }
      }
    } catch (err) {
      console.warn('Could not parse records file:', err.message);
    }
  }

  // 4. Optionally clean up local credential files
  const confirmCleanFiles = await askQuestion(`\nRemove local credential files (~/.site-inspection-test.env and ~/.site-inspection-test-users.json)? (y/N): `);
  if (confirmCleanFiles.toLowerCase() === 'y' || confirmCleanFiles.toLowerCase() === 'yes') {
    if (fs.existsSync(envFilePath)) fs.unlinkSync(envFilePath);
    if (fs.existsSync(jsonFilePath)) fs.unlinkSync(jsonFilePath);
    if (fs.existsSync(recordsFilePath)) fs.unlinkSync(recordsFilePath);
    console.log('Local test credential files removed.');
  }

  console.log('\nCleanup script completed.');
}

main().catch((err) => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
