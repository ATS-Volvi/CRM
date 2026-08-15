import { customMasterData } from "../mockData/customMasterData";
import crypto from "crypto";

export async function populateMasterData(sequelize: any) {
  const models = sequelize.models;
  console.log(`[MASTER DATA] Starting import of ${customMasterData.length} master data line items...`);

  // Extract distinct categories
  const categoryMap = new Map<string, string>(); // categoryName -> requirementId
  const uniqueCategories = Array.from(new Set(customMasterData.map(item => item.category)));

  console.log(`[MASTER DATA] Clearing old master data & price book entries...`);
  await sequelize.query(`DELETE FROM "ConstructionItems";`);
  await sequelize.query(`DELETE FROM "LineItems";`);
  await sequelize.query(`DELETE FROM "Requirements";`);
  await sequelize.query(`DELETE FROM "PriceBookEntries";`);

  console.log(`[MASTER DATA] Inserting ${uniqueCategories.length} Requirements categories...`);
  for (const catName of uniqueCategories) {
    const reqId = crypto.randomUUID();
    await models.Requirement.create({
      id: reqId,
      name: catName,
      category: catName,
      description: `Master deliverables & specifications for ${catName}`,
      isActive: true
    });
    categoryMap.set(catName, reqId);
  }

  console.log(`[MASTER DATA] Inserting ${customMasterData.length} LineItems, ConstructionItems, and PriceBookEntries...`);
  for (const item of customMasterData) {
    const reqId = categoryMap.get(item.category);
    const lineItemId = crypto.randomUUID();

    // 1. Create LineItem
    await models.LineItem.create({
      id: lineItemId,
      requirementId: reqId,
      name: item.lineItem,
      unit: item.unit,
      description: `${item.category} - ${item.lineItem} (${item.unit})`,
      defaultQuantity: 1
    });

    // 2. Create ConstructionItem (pricing & BOM link)
    await models.ConstructionItem.create({
      id: crypto.randomUUID(),
      lineItemId: lineItemId,
      name: item.lineItem,
      category: "material",
      unit: item.unit,
      quantityPerLineItem: 1,
      unitCost: Math.round(item.rate * 0.75),
      unitPrice: item.rate,
      isActive: true
    });

    // 3. Create PriceBookEntry
    await models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      sku: item.sku,
      name: item.lineItem,
      category: item.category,
      unitPrice: item.rate,
      minPrice: Math.round(item.rate * 0.85),
      maxPrice: Math.round(item.rate * 1.15),
      costPrice: Math.round(item.rate * 0.75),
      description: `Unit: ${item.unit} | Estimated Rate: ₹${item.rate.toLocaleString('en-IN')}`
    });
  }

  console.log(`[MASTER DATA] Successfully seeded all 25 categories and 215 line items!`);
}

// Standalone execution script
if (require.main === module) {
  const { sequelize } = require("../../../database/models");
  (async () => {
    try {
      await sequelize.authenticate();
      console.log("[DB] Connected to database.");
      await populateMasterData(sequelize);
      process.exit(0);
    } catch (err) {
      console.error("[DB ERROR]", err);
      process.exit(1);
    }
  })();
}
