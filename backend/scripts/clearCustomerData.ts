import { sequelize } from '@nexus-crm/database';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  try {
    // ensure DB is reachable
    await sequelize.authenticate();
    // sequelize.config.storage is the sqlite path (cast to access dialect-specific option)
    const dialectOptions = (sequelize as any).config;
    const sqlitePath = (sequelize.getDialect() === 'sqlite')
      ? (dialectOptions.storage as string)
      : '';
    // backup
    const backupsDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, `nexus_crm_${timestamp}.sqlite`);
    if (sqlitePath) fs.copyFileSync(sqlitePath, backupPath);
    console.log('Backup created at', backupPath);

    // tables to keep
    const KEEP = [
      'User',
      'Requirement',
      'LineItem',
      'ConstructionItem',
      'PriceBookEntry',
      'PipelineStage',
      'ApprovalTier',
      'KpiMaster',
      'KpiTarget',
      'SalesApprovalProfile',
      'MessageTemplate',
      'AutomationRule',
      'GmailConfig',
      'AssignmentRule',
      'BundleTemplate',
      'BundleItem'
    ];

    // fetch all tables
    const [tablesRows] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    const allTables = (tablesRows as Array<{ name: string }>).map(r => r.name);
    const tablesToRemove = allTables.filter(t => !KEEP.includes(t));

    // row counts before
    console.log('--- Row counts BEFORE deletion ---');
    for (const tbl of allTables) {
      const [rows] = await sequelize.query(`SELECT COUNT(*) as cnt FROM "${tbl}";`);
      const cnt = (rows as Array<{ cnt: number }>)[0]?.cnt ?? 0;
      console.log(`${tbl}: ${cnt}`);
    }

    // disable FK checks
    await sequelize.query('PRAGMA foreign_keys = OFF;');

    // delete data
    for (const tbl of tablesToRemove) {
      await sequelize.query(`DELETE FROM "${tbl}";`);
    }

    // re-enable FK checks
    await sequelize.query('PRAGMA foreign_keys = ON;');

    // row counts after
    console.log('--- Row counts AFTER deletion ---');
    for (const tbl of allTables) {
      const [rows] = await sequelize.query(`SELECT COUNT(*) as cnt FROM "${tbl}";`);
      const cnt = (rows as Array<{ cnt: number }>)[0]?.cnt ?? 0;
      console.log(`${tbl}: ${cnt}`);
    }

    console.log('Cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
})();
