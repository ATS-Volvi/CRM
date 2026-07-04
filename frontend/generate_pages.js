const fs = require('fs');
const pages = [
  'LeadInbox', 'LeadDetail', 'PipelineKanban', 'QuotationBuilder', 
  'QuoteHistory', 'PriceBook', 'PurchaseOrders', 'ApprovalQueue', 
  'AssignmentRules', 'KpiDashboard', 'ManagementDashboard'
];
pages.forEach(p => {
  fs.writeFileSync(`src/pages/${p}.tsx`, `export default function ${p}() { return <div className="p-8"><h1>${p}</h1></div>; }\n`);
});
