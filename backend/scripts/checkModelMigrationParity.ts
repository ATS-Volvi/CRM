import * as fs from 'fs';
import * as path from 'path';

// Pluralization map helper for model name to table name
const tableMap: Record<string, string> = {
  User: 'Users',
  Lead: 'Leads',
  PipelineStage: 'PipelineStages',
  LeadStageHistory: 'LeadStageHistories',
  Deal: 'Deals',
  Quote: 'Quotes',
  PriceBookEntry: 'PriceBookEntries',
  QuoteLineItem: 'QuoteLineItems',
  PurchaseOrder: 'PurchaseOrders',
  ApprovalRequest: 'ApprovalRequests',
  AssignmentRule: 'AssignmentRules',
  Activity: 'Activities',
  Invoice: 'Invoices',
  InvoiceLineItem: 'InvoiceLineItems',
  BundleTemplate: 'BundleTemplates',
  BundleItem: 'BundleItems',
  ApprovalTier: 'ApprovalTiers',
  KpiTarget: 'KpiTargets',
  Requirement: 'Requirements',
  LineItem: 'LineItems',
  ConstructionItem: 'ConstructionItems',
  MessageTemplate: 'MessageTemplates',
  Customer: 'Customers',
  LeadSource: 'LeadSources',
  LeadReassignmentHistory: 'LeadReassignmentHistories'
};

const modelsPath = path.resolve(__dirname, '../../database/models/index.ts');
const migrationsDir = path.resolve(__dirname, '../../database/migrations');

function main() {
  if (!fs.existsSync(modelsPath)) {
    console.error(`Models file not found at: ${modelsPath}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(modelsPath, 'utf-8');
  
  // Find all migrations
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({
      name: f,
      content: fs.readFileSync(path.join(migrationsDir, f), 'utf-8')
    }));

  // Parse models and their fields
  const modelRegex = /(\w+)\.init\(\s*\{([\s\S]*?)\}\s*,\s*\{\s*sequelize/g;
  let match;
  const modelFields: Record<string, string[]> = {};

  while ((match = modelRegex.exec(indexContent)) !== null) {
    const modelName = match[1];
    const fieldsBlock = match[2];
    
    // Strip nested braces to ignore inner attributes (like ENUM values, validations, references)
    let stripped = fieldsBlock;
    while (/\{[^{}]*\}/.test(stripped)) {
      stripped = stripped.replace(/\{[^{}]*\}/g, '');
    }

    // Parse individual field names from the top level
    const fieldRegex = /^\s*(\w+)\s*:/gm;
    let fieldMatch;
    const fields: string[] = [];
    while ((fieldMatch = fieldRegex.exec(stripped)) !== null) {
      fields.push(fieldMatch[1]);
    }
    modelFields[modelName] = fields;
  }

  let failed = false;
  console.log('| Model | Field | Has Migration (Y/N) | Details |');
  console.log('|---|---|---|---|');

  for (const [modelName, fields] of Object.entries(modelFields)) {
    const tableName = tableMap[modelName] || (modelName + 's');
    
    for (const field of fields) {
      let hasMigration = false;
      let matchedFile = '';

      // Check all migration contents
      for (const m of migrationFiles) {
        // Match table name and field name in either createTable or addColumn
        const hasCreateTableField = m.content.includes(tableName) && 
          new RegExp(`createTable(Safe)?\\s*\\(\\s*['"\`]${tableName}['"\`][\\s\\S]*?\\b${field}\\s*:`, 'i').test(m.content);
        
        const hasAddColumnField = m.content.includes(tableName) && 
          new RegExp(`addColumn\\s*\\(\\s*['"\`]${tableName}['"\`]\\s*,\\s*['"\`]${field}['"\`]`, 'i').test(m.content);

        if (hasCreateTableField || hasAddColumnField) {
          hasMigration = true;
          matchedFile = m.name;
          break;
        }
      }

      if (hasMigration) {
        console.log(`| ${modelName} | ${field} | Y | Matches in ${matchedFile} |`);
      } else {
        console.log(`| ${modelName} | ${field} | N | MISSING MIGRATION |`);
        failed = true;
      }
    }
  }

  if (failed) {
    console.error('\nParity Check Failed: Some model fields do not have corresponding migrations!');
    process.exit(1);
  } else {
    console.log('\nParity Check Passed: All model fields are mapped to migrations successfully.');
    process.exit(0);
  }
}

main();
