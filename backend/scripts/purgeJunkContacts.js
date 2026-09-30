/**
 * backend/scripts/purgeJunkContacts.js
 *
 * Scans Contacts for test artefacts (names like "Rate Limit", "Test SQLi", "dummy", etc.)
 * and optionally deletes them along with related DealContacts rows.
 *
 * Usage:
 *   node backend/scripts/purgeJunkContacts.js            # Dry run (default)
 *   node backend/scripts/purgeJunkContacts.js --apply    # Execute deletion
 *
 * Database targeting:
 *   - If DATABASE_URL is set (and USE_SQLITE is not true), connects to Postgres (e.g. Render / Neon).
 *   - Otherwise, falls back to local nexus_crm.sqlite.
 *   - To force Postgres: DATABASE_URL="<url>" USE_SQLITE=false node backend/scripts/purgeJunkContacts.js
 */

const fs = require('fs');
const path = require('path');

// 1. Parse arguments
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const forcePostgres = args.includes('--postgres');

// 2. Load .env if DATABASE_URL is not already in environment
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

// 3. Determine database target
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const isSqlite = !forcePostgres && (process.env.USE_SQLITE === 'true' || !hasDatabaseUrl);

const JUNK_REGEX = /rate limit|sqli|sql injection|test|dummy|xss|<script/i;

function isJunkContact(c) {
  const fields = [
    c.firstName || '',
    c.lastName || '',
    c.email || '',
    c.role || '',
    c.phone || '',
    c.sourceChannel || ''
  ];
  const combined = fields.join(' ');
  return JUNK_REGEX.test(combined);
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────
async function runPostgres() {
  const { Client } = require('pg');
  const dbUrl = process.env.DATABASE_URL;

  console.log('='.repeat(70));
  console.log('PURGE JUNK CONTACTS - TARGET: PostgreSQL');
  console.log(`Connection URL: ${dbUrl.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`Mode: ${isApply ? 'APPLY (Deletions will be executed)' : 'DRY RUN (Read-only)'}`);
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check if Contacts table exists
    const tableCheck = await client.query(
      `SELECT to_regclass('public."Contacts"') as exists`
    );
    if (!tableCheck.rows[0].exists) {
      console.log('Contacts table does not exist in this database.');
      await client.end();
      return;
    }

    const { rows: allContacts } = await client.query(
      `SELECT id, "accountId", "firstName", "lastName", email, phone, role, "sourceChannel", "createdAt" FROM "Contacts"`
    );

    const junkContacts = allContacts.filter(isJunkContact);

    console.log(`\nTotal contacts in DB: ${allContacts.length}`);
    console.log(`Identified junk contacts matching pattern: ${junkContacts.length}\n`);

    if (junkContacts.length === 0) {
      console.log('✔ No junk contact artefacts found. Database is clean.');
      await client.end();
      return;
    }

    // Inspect related DealContacts for each junk contact
    const enrichedJunk = [];
    for (const contact of junkContacts) {
      const dealCountRes = await client.query(
        `SELECT count(*) as count FROM "DealContacts" WHERE "contactId" = $1`,
        [contact.id]
      ).catch(() => ({ rows: [{ count: 0 }] }));

      enrichedJunk.push({
        ...contact,
        dealContactsCount: parseInt(dealCountRes.rows[0].count, 10) || 0
      });
    }

    // Print table of rows to delete
    console.log('Junk Contacts Found:');
    console.table(
      enrichedJunk.map((c) => ({
        ID: c.id,
        Name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || '(No Name)',
        Email: c.email || '(No Email)',
        Role: c.role || '(None)',
        AccountID: c.accountId || '(None)',
        DealLinks: c.dealContactsCount
      }))
    );

    if (!isApply) {
      console.log('\n[DRY RUN] No changes were made.');
      console.log('To permanently delete these rows and their related DealContacts, rerun with:');
      console.log('  node backend/scripts/purgeJunkContacts.js --apply\n');
    } else {
      console.log('\n[APPLY] Deleting identified junk contacts and associated DealContacts...');
      let deletedDealContacts = 0;
      let deletedContacts = 0;

      for (const c of enrichedJunk) {
        if (c.dealContactsCount > 0) {
          const dcRes = await client.query(
            `DELETE FROM "DealContacts" WHERE "contactId" = $1`,
            [c.id]
          );
          deletedDealContacts += dcRes.rowCount || 0;
        }

        const cRes = await client.query(
          `DELETE FROM "Contacts" WHERE id = $1`,
          [c.id]
        );
        deletedContacts += cRes.rowCount || 0;
      }

      console.log(`✔ Successfully purged ${deletedContacts} junk Contacts and ${deletedDealContacts} DealContacts.`);
    }

    await client.end();
  } catch (err) {
    console.error('Postgres error:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLITE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────
async function runSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const sqlitePath = path.resolve(__dirname, '../../nexus_crm.sqlite');

  console.log('='.repeat(70));
  console.log('PURGE JUNK CONTACTS - TARGET: SQLite');
  console.log(`Database File: ${sqlitePath}`);
  console.log(`Mode: ${isApply ? 'APPLY (Deletions will be executed)' : 'DRY RUN (Read-only)'}`);
  console.log('='.repeat(70));

  if (!fs.existsSync(sqlitePath)) {
    console.log(`SQLite database file not found at ${sqlitePath}`);
    return;
  }

  const db = new sqlite3.Database(sqlitePath);

  const queryAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

  const runSql = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

  try {
    // Check if Contacts table exists
    const tables = await queryAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Contacts'"
    );
    if (tables.length === 0) {
      console.log('Contacts table does not exist in SQLite database.');
      db.close();
      return;
    }

    const allContacts = await queryAll(
      'SELECT id, accountId, firstName, lastName, email, phone, role, sourceChannel, createdAt FROM Contacts'
    );

    const junkContacts = allContacts.filter(isJunkContact);

    console.log(`\nTotal contacts in DB: ${allContacts.length}`);
    console.log(`Identified junk contacts matching pattern: ${junkContacts.length}\n`);

    if (junkContacts.length === 0) {
      console.log('✔ No junk contact artefacts found. Database is clean.');
      db.close();
      return;
    }

    // Inspect related DealContacts
    const enrichedJunk = [];
    for (const contact of junkContacts) {
      let dealContactsCount = 0;
      try {
        const rows = await queryAll(
          'SELECT count(*) as count FROM DealContacts WHERE contactId = ?',
          [contact.id]
        );
        dealContactsCount = rows[0]?.count || 0;
      } catch (_) {}

      enrichedJunk.push({
        ...contact,
        dealContactsCount
      });
    }

    // Print table of rows
    console.log('Junk Contacts Found:');
    console.table(
      enrichedJunk.map((c) => ({
        ID: c.id,
        Name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || '(No Name)',
        Email: c.email || '(No Email)',
        Role: c.role || '(None)',
        AccountID: c.accountId || '(None)',
        DealLinks: c.dealContactsCount
      }))
    );

    if (!isApply) {
      console.log('\n[DRY RUN] No changes were made.');
      console.log('To permanently delete these rows and their related DealContacts, rerun with:');
      console.log('  node backend/scripts/purgeJunkContacts.js --apply\n');
    } else {
      console.log('\n[APPLY] Deleting identified junk contacts and associated DealContacts...');
      let deletedDealContacts = 0;
      let deletedContacts = 0;

      for (const c of enrichedJunk) {
        if (c.dealContactsCount > 0) {
          const dcChanges = await runSql(
            'DELETE FROM DealContacts WHERE contactId = ?',
            [c.id]
          );
          deletedDealContacts += dcChanges || 0;
        }

        const cChanges = await runSql(
          'DELETE FROM Contacts WHERE id = ?',
          [c.id]
        );
        deletedContacts += cChanges || 0;
      }

      console.log(`✔ Successfully purged ${deletedContacts} junk Contacts and ${deletedDealContacts} DealContacts.`);
    }

    db.close();
  } catch (err) {
    console.error('SQLite error:', err);
    db.close();
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (isSqlite) {
    await runSqlite();
  } else {
    await runPostgres();
  }
})();
