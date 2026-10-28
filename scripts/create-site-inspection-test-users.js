#!/usr/bin/env node
/**
 * scripts/create-site-inspection-test-users.js
 *
 * Creates three test users using the CRM's own HTTP API endpoints:
 *   - "ZZ TEST Site Manager <timestamp>" (role: site_manager)
 *   - "ZZ TEST Ops Manager <timestamp>" (role: ops_manager)
 *   - "ZZ TEST Sales Rep <timestamp>" (role: sales_rep)
 *
 * Sets the site_manager's isAvailable: false, onLeave: true, status: "Inactive"
 * so automatic assignment never assigns real inspections to this test user.
 *
 * Writes credentials to ~/.site-inspection-test.env (chmod 0600)
 * Writes created user IDs to ~/.site-inspection-test-users.json (chmod 0600)
 *
 * Never prints passwords, bypass tokens or secrets.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

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
    console.error(`ERROR: PREVIEW_URL appears to contain a placeholder: "${baseUrl}".`);
    console.error(`Please provide the real deployed Vercel preview URL.`);
    process.exit(1);
  }

  const homeDir = os.homedir();
  const envFilePath = path.join(homeDir, '.site-inspection-test.env');
  const jsonFilePath = path.join(homeDir, '.site-inspection-test-users.json');

  // Verify ~/.site-inspection-test.env is outside any git repo
  try {
    const isGitRepo = execSync(`git -C "${homeDir}" rev-parse --is-inside-work-tree 2>/dev/null`, {
      encoding: 'utf8',
    }).trim();
    if (isGitRepo === 'true') {
      console.error(`ERROR: Target directory ${homeDir} is inside a git repository! Aborting.`);
      process.exit(1);
    }
  } catch (err) {
    // Expected: home directory is not a git repository
  }

  console.log(`Connecting to CRM API at: ${baseUrl}`);

  const defaultHeaders = { 'Content-Type': 'application/json' };
  if (VERCEL_BYPASS_TOKEN) {
    defaultHeaders['x-vercel-protection-bypass'] = VERCEL_BYPASS_TOKEN;
  }

  // 1. Log in as Admin to verify credentials and obtain JWT
  console.log(`Authenticating as Admin...`);
  let loginRes;
  try {
    loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      redirect: 'manual', // do not auto-follow redirects to SSO
    });
  } catch (netErr) {
    console.error(`ERROR: Network connection failed to ${baseUrl}: ${netErr.message}`);
    process.exit(1);
  }

  if (loginRes.status === 302 || loginRes.status === 307 || loginRes.status === 308) {
    const loc = loginRes.headers.get('location') || '';
    if (loc.includes('vercel.com/sso-api') || loc.includes('vercel-auth')) {
      console.error(`ERROR: Preview deployment is protected by Vercel Authentication (HTTP ${loginRes.status}).`);
      console.error(`Action required:`);
      console.error(`  1. In Vercel Dashboard (nexus-sales-crm > Settings > Deployment Protection), set Vercel Authentication to "Only Production" or "Disabled" for Previews.`);
      console.error(`  2. Or generate a Protection Bypass for Automation secret and export VERCEL_BYPASS_TOKEN before running.`);
      process.exit(1);
    }
  }

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    if (errText.includes('DEPLOYMENT_NOT_FOUND')) {
      console.error(`ERROR: Vercel returned DEPLOYMENT_NOT_FOUND (HTTP 404).`);
      console.error(`The preview URL "${baseUrl}" does not exist or has expired. Please check PR #38 comments for active preview links.`);
      process.exit(1);
    }
    console.error(`ERROR: Admin login failed (HTTP ${loginRes.status}): ${errText}`);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  if (!adminToken) {
    console.error(`ERROR: No token returned in admin login response.`);
    process.exit(1);
  }
  console.log(`Admin authenticated successfully.`);

  // 2. Generate credentials and users
  const timestamp = Date.now();
  function generatePassword() {
    return crypto.randomBytes(18).toString('base64url').slice(0, 24);
  }

  const siteManagerCreds = {
    name: `ZZ TEST Site Manager ${timestamp}`,
    email: `zz-test-site_manager-${timestamp}@example.com`,
    password: generatePassword(),
    role: 'site_manager',
  };

  const opsManagerCreds = {
    name: `ZZ TEST Ops Manager ${timestamp}`,
    email: `zz-test-ops_manager-${timestamp}@example.com`,
    password: generatePassword(),
    role: 'ops_manager',
  };

  const salesRepCreds = {
    name: `ZZ TEST Sales Rep ${timestamp}`,
    email: `zz-test-sales_rep-${timestamp}@example.com`,
    password: generatePassword(),
    role: 'sales_rep',
  };

  const usersToCreate = [
    { key: 'siteManager', creds: siteManagerCreds },
    { key: 'opsManager', creds: opsManagerCreds },
    { key: 'salesRep', creds: salesRepCreds },
  ];

  const createdMetadata = {
    createdAt: new Date().toISOString(),
    previewUrl: baseUrl,
  };

  console.log(`Creating test user accounts via /api/v1/auth/register...`);

  for (const { key, creds } of usersToCreate) {
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        name: creds.name,
        email: creds.email,
        password: creds.password,
        role: creds.role,
      }),
    });

    if (!regRes.ok) {
      const errText = await regRes.text();
      console.error(`ERROR: Failed to create ${creds.role} (${creds.email}): ${errText}`);
      process.exit(1);
    }

    const regData = await regRes.json();
    const createdUser = regData.user || {};
    createdMetadata[key] = {
      id: createdUser.id,
      name: createdUser.name || creds.name,
      email: createdUser.email || creds.email,
      role: createdUser.role || creds.role,
    };
  }

  // 3. Set test site_manager availability to false (and onLeave / Inactive)
  // so auto-assignment in requestSiteInspection ignores this account
  const siteManagerId = createdMetadata.siteManager.id;
  console.log(`Setting site_manager (${siteManagerId}) availability to false & Inactive...`);

  const authHeaders = {
    ...defaultHeaders,
    Authorization: `Bearer ${adminToken}`,
  };

  const availRes = await fetch(`${baseUrl}/api/v1/settings/availability`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      userId: siteManagerId,
      isAvailable: false,
      onLeave: true,
      status: 'Inactive',
    }),
  });

  if (!availRes.ok) {
    console.warn(`Notice: Updating via /settings/availability returned ${availRes.status}. Retrying via /salespersons/${siteManagerId}/availability...`);
    const fallbackRes = await fetch(`${baseUrl}/api/v1/salespersons/${siteManagerId}/availability`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        userId: siteManagerId,
        isAvailable: false,
        onLeave: true,
        status: 'Inactive',
      }),
    });
    if (!fallbackRes.ok) {
      console.error(`ERROR: Failed to update site_manager availability: ${await fallbackRes.text()}`);
      process.exit(1);
    }
  }
  console.log(`Site manager availability set to false successfully.`);

  // 4. Write ~/.site-inspection-test.env (permissions: 0600)
  const envContent = [
    `SITE_MANAGER_EMAIL=${siteManagerCreds.email}`,
    `SITE_MANAGER_PASSWORD=${siteManagerCreds.password}`,
    `OPS_MANAGER_EMAIL=${opsManagerCreds.email}`,
    `OPS_MANAGER_PASSWORD=${opsManagerCreds.password}`,
    `SALES_REP_EMAIL=${salesRepCreds.email}`,
    `SALES_REP_PASSWORD=${salesRepCreds.password}`,
    ``,
  ].join('\n');

  fs.writeFileSync(envFilePath, envContent, { mode: 0o600 });
  fs.chmodSync(envFilePath, 0o600);

  // 5. Write ~/.site-inspection-test-users.json (permissions: 0600)
  fs.writeFileSync(jsonFilePath, JSON.stringify(createdMetadata, null, 2), { mode: 0o600 });
  fs.chmodSync(jsonFilePath, 0o600);

  // 6. Print summary (strictly emails and paths, never passwords or tokens)
  console.log(`\n======================================================`);
  console.log(`TEST USERS CREATED SUCCESSFULLY:`);
  console.log(`  Site Manager: ${siteManagerCreds.email}`);
  console.log(`  Ops Manager:  ${opsManagerCreds.email}`);
  console.log(`  Sales Rep:    ${salesRepCreds.email}`);
  console.log(``);
  console.log(`Credentials saved to: ${envFilePath} (permissions: 0600)`);
  console.log(`User metadata saved to: ${jsonFilePath} (permissions: 0600)`);
  console.log(``);
  console.log(`REMINDER: Run 'node scripts/delete-site-inspection-test-users.js' after test completion to clean up/deactivate these test users.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error creating test users:', err);
  process.exit(1);
});
