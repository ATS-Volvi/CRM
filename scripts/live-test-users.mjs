#!/usr/bin/env node
/**
 * scripts/live-test-users.mjs
 *
 * 1. Validates baseUrl and production guards (--i-know-this-is-production).
 * 2. Warms up backend with GET /api/health (retrying up to 120 seconds).
 * 3. Prompts for Admin login credentials using hidden password prompt.
 * 4. Logs in as admin via POST /api/v1/auth/login.
 * 5. Creates 3 test users via POST /api/v1/auth/register:
 *    - "ZZ TEST Site Manager" (site_manager)
 *    - "ZZ TEST Ops Manager" (ops_manager)
 *    - "ZZ TEST Sales Rep" (sales_rep)
 * 6. Saves credentials to ~/.live-test.env (chmod 0600) and metadata to
 *    ~/.live-test-records.json (chmod 0600) outside any git repository.
 * 7. Prints ONLY the three emails and file paths (never passwords or tokens).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promptHidden, promptText } from './lib/prompt.mjs';
import {
  validateUrlAndArgs,
  ensureSafeOutputDir,
  generateRandomPassword,
} from './live-test-utils.mjs';

async function warmUpHealth(baseUrl) {
  process.stdout.write(`Checking /api/health at ${baseUrl} (retrying up to 120s for service warm-up)...\n`);
  const startTime = Date.now();
  const maxWaitMs = 120 * 1000;
  let attempt = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`Health check passed (HTTP ${res.status}) after ${elapsed}s.\n`);
        return true;
      }
      process.stdout.write(`Attempt ${attempt}: /api/health returned HTTP ${res.status}. Retrying in 3s...\n`);
    } catch (err) {
      process.stdout.write(`Attempt ${attempt}: waiting for service (${err.message})...\n`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.error(`\nERROR: Health check did not succeed within 120 seconds.\n`);
  process.exit(1);
}

async function main() {
  const baseUrl = validateUrlAndArgs(process.argv, 'live-test-users.mjs');
  const homeDir = os.homedir();
  ensureSafeOutputDir(homeDir);

  const envFilePath = path.join(homeDir, '.live-test.env');
  const jsonFilePath = path.join(homeDir, '.live-test-records.json');

  // Step 1: Warm up service
  await warmUpHealth(baseUrl);

  // Step 2: Prompt for Admin login (hidden password prompt)
  process.stdout.write(`\nEnter Admin credentials to create the test accounts:\n`);
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

  // Step 3: Admin authentication
  process.stdout.write(`\nAuthenticating as Admin at ${baseUrl}...\n`);
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
  process.stdout.write(`Admin authenticated successfully.\n`);

  // Step 4: Generate unique credentials and create test users
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

  process.stdout.write(`Creating test user accounts...\n`);
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
    const createdUserId = regData?.user?.id || regData?.id;

    records.users[user.key] = {
      id: createdUserId,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  // Step 5: Save credentials to ~/.live-test.env with mode 0600
  const envContent = [
    `# Nexus CRM Live Test Credentials - Generated ${new Date().toISOString()}`,
    `BASE_URL=${baseUrl}`,
    `SITE_MANAGER_EMAIL=${testUsers[0].email}`,
    `SITE_MANAGER_PASSWORD=${testUsers[0].password}`,
    `OPS_MANAGER_EMAIL=${testUsers[1].email}`,
    `OPS_MANAGER_PASSWORD=${testUsers[1].password}`,
    `SALES_REP_EMAIL=${testUsers[2].email}`,
    `SALES_REP_PASSWORD=${testUsers[2].password}`,
    '',
  ].join('\n');

  fs.writeFileSync(envFilePath, envContent, { mode: 0o600 });
  fs.chmodSync(envFilePath, 0o600);

  // Save records to ~/.live-test-records.json with mode 0600
  fs.writeFileSync(jsonFilePath, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.chmodSync(jsonFilePath, 0o600);

  // Step 6: Print ONLY the three emails and file paths
  process.stdout.write(`\nTest users created successfully.\n`);
  process.stdout.write(`Site Manager: ${testUsers[0].email}\n`);
  process.stdout.write(`Ops Manager:  ${testUsers[1].email}\n`);
  process.stdout.write(`Sales Rep:    ${testUsers[2].email}\n`);
  process.stdout.write(`\nCredentials saved to: ${envFilePath}\n`);
  process.stdout.write(`Records saved to:     ${jsonFilePath}\n\n`);
}

main().catch((err) => {
  console.error(`FATAL ERROR: ${err?.message || err}`);
  process.exit(1);
});
