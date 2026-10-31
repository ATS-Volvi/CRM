#!/usr/bin/env node
/**
 * scripts/live-test-users.mjs
 *
 * 1. Validates BASE_URL and production guards.
 * 2. Prompts for admin email and password on /dev/tty with hidden input.
 * 3. Sends warm-up GET /api/health with retries up to 90 seconds.
 * 4. Logs in as admin via POST /api/v1/auth/login.
 * 5. Creates three test users via POST /api/v1/auth/register:
 *    - "ZZ TEST Site Manager" (site_manager)
 *    - "ZZ TEST Ops Manager" (ops_manager)
 *    - "ZZ TEST Sales Rep" (sales_rep)
 * 6. Saves credentials to ~/.live-test.env (chmod 0600) and metadata
 *    to ~/.live-test-records.json (chmod 0600) outside any git repository.
 * 7. Prints only the three emails and file paths (never passwords).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateUrlAndArgs,
  ensureSafeOutputDir,
  promptHidden,
  promptText,
  generateRandomPassword,
} from './live-test-utils.mjs';

async function warmUpHealth(baseUrl) {
  console.log(`Checking /api/health at ${baseUrl} (retrying up to 90s for free instance warm-up)...`);
  const startTime = Date.now();
  const maxWaitMs = 90 * 1000;
  let attempt = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`Health check passed (HTTP ${res.status}) after ${elapsed}s.`);
        return true;
      }
      console.log(`Attempt ${attempt}: /api/health returned HTTP ${res.status}. Retrying in 3s...`);
    } catch (err) {
      console.log(`Attempt ${attempt}: waiting for service (${err.message})...`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.error(`ERROR: Health check did not succeed within 90 seconds.`);
  process.exit(1);
}

async function main() {
  const baseUrl = validateUrlAndArgs(process.argv, 'live-test-users.mjs');
  const homeDir = os.homedir();
  ensureSafeOutputDir(homeDir);

  const envFilePath = path.join(homeDir, '.live-test.env');
  const jsonFilePath = path.join(homeDir, '.live-test-records.json');

  // Step 1: Health warm-up
  await warmUpHealth(baseUrl);

  // Step 2: Prompt for Admin login (hidden input on /dev/tty)
  console.log(`\nEnter Admin credentials to create the test accounts:`);
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

  // Step 3: Admin login
  console.log(`\nAuthenticating as Admin at ${baseUrl}...`);
  let loginRes;
  try {
    loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
  } catch (err) {
    console.error(`ERROR: Failed to connect to login endpoint: ${err.message}`);
    process.exit(1);
  }

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    console.error(`ERROR: Admin login failed (HTTP ${loginRes.status}): ${errText}`);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  if (!adminToken) {
    console.error(`ERROR: Login succeeded but no auth token returned.`);
    process.exit(1);
  }
  console.log(`Admin authenticated successfully.`);

  // Step 4: Generate credentials and create test users
  const timestamp = Date.now();
  const testUsers = [
    {
      key: 'siteManager',
      role: 'site_manager',
      name: 'ZZ TEST Site Manager',
      email: `zz-test-site_manager-${timestamp}@example.com`,
      password: generateRandomPassword(24),
    },
    {
      key: 'opsManager',
      role: 'ops_manager',
      name: 'ZZ TEST Ops Manager',
      email: `zz-test-ops_manager-${timestamp}@example.com`,
      password: generateRandomPassword(24),
    },
    {
      key: 'salesRep',
      role: 'sales_rep',
      name: 'ZZ TEST Sales Rep',
      email: `zz-test-sales_rep-${timestamp}@example.com`,
      password: generateRandomPassword(24),
    },
  ];

  console.log(`Creating test user accounts via /api/v1/auth/register...`);
  const records = {
    baseUrl,
    createdAt: new Date().toISOString(),
    users: {},
    leads: [],
    inspections: [],
    attachments: [],
    opportunities: [],
  };

  for (const user of testUsers) {
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
      }),
    });

    if (!regRes.ok) {
      const errText = await regRes.text();
      console.error(`ERROR: Failed to create ${user.role} (${user.email}): ${errText}`);
      process.exit(1);
    }

    const regData = await regRes.json();
    const created = regData.user || {};
    records.users[user.key] = {
      id: created.id,
      name: created.name || user.name,
      email: created.email || user.email,
      role: created.role || user.role,
    };
  }

  // Deactivate availability for site_manager and ops_manager so lead auto-assignment routes to sales reps
  for (const key of ['siteManager', 'opsManager']) {
    const u = records.users[key];
    if (u?.id) {
      await fetch(`${baseUrl}/api/v1/settings/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          userId: u.id,
          isAvailable: false,
          onLeave: true,
          status: 'Inactive',
        }),
      }).catch(() => {});
    }
  }

  // Step 5: Save credentials to ~/.live-test.env (chmod 0600)
  const envLines = [
    `BASE_URL=${baseUrl}`,
    `SITE_MANAGER_EMAIL=${testUsers[0].email}`,
    `SITE_MANAGER_PASSWORD=${testUsers[0].password}`,
    `OPS_MANAGER_EMAIL=${testUsers[1].email}`,
    `OPS_MANAGER_PASSWORD=${testUsers[1].password}`,
    `SALES_REP_EMAIL=${testUsers[2].email}`,
    `SALES_REP_PASSWORD=${testUsers[2].password}`,
    ``,
  ];
  fs.writeFileSync(envFilePath, envLines.join('\n'), { mode: 0o600 });
  fs.chmodSync(envFilePath, 0o600);

  // Step 6: Save created records to ~/.live-test-records.json (chmod 0600)
  fs.writeFileSync(jsonFilePath, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.chmodSync(jsonFilePath, 0o600);

  // Step 7: Print only emails and file paths, never passwords
  console.log(`\n========================================================================`);
  console.log(`TEST USERS CREATED SUCCESSFULLY:`);
  for (const user of testUsers) {
    console.log(`  - ${user.name} (${user.role}): ${user.email}`);
  }
  console.log(`\nCredentials written to: ${envFilePath} (permissions: 0600)`);
  console.log(`Records written to:     ${jsonFilePath} (permissions: 0600)`);
  console.log(`========================================================================\n`);
}

main().catch((err) => {
  console.error(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
