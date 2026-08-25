import { Database, Requirement, LineItem, ConstructionItem, PriceBookEntry } from "@nexus-crm/database";
import crypto from "crypto";
import { customMasterData } from "../mockData/customMasterData";

async function main() {
  console.log("Connecting to Database...");
  const db = await Database.createConnection();

  console.log(`Loading ${customMasterData.length} items from customMasterData into Master Data & Pricing Grid...`);

  // 1. Requirements (Categories)
  const categoryMap = new Map<string, any>();
  const uniqueCategories = Array.from(new Set(customMasterData.map(d => d.category)));

  for (const cat of uniqueCategories) {
    let req = await Requirement.findOne({ where: { name: cat } });
    if (!req) {
      req = await Requirement.create({
        id: crypto.randomUUID(),
        name: cat,
        category: cat,
        description: `${cat} Specification & BOM Catalog`,
        isActive: true
      });
    }
    categoryMap.set(cat, req);
  }
  console.log(`✓ Synchronized ${uniqueCategories.length} Categories/Requirements.`);

  // 2. Line Items & Construction Items (Pricing Grid)
  let lineItemsCreated = 0;
  let constructionItemsCreated = 0;

  for (const item of customMasterData) {
    const req = categoryMap.get(item.category);
    if (!req) continue;

    let lineItem = await LineItem.findOne({
      where: {
        requirementId: req.id,
        name: item.lineItem,
        unit: item.unit
      }
    });

    if (!lineItem) {
      lineItem = await LineItem.create({
        id: crypto.randomUUID(),
        requirementId: req.id,
        name: item.lineItem,
        unit: item.unit,
        defaultQuantity: 1
      });
      lineItemsCreated++;
    }

    let ci = await ConstructionItem.findOne({
      where: {
        lineItemId: lineItem.id
      }
    });

    if (!ci) {
      ci = await ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: lineItem.id,
        name: item.lineItem,
        category: "material",
        unit: item.unit,
        quantityPerLineItem: 1,
        unitCost: item.rate,
        unitPrice: item.rate,
        isActive: true
      });
      constructionItemsCreated++;
    } else {
      await ci.update({
        unitCost: item.rate,
        unitPrice: item.rate,
        unit: item.unit
      });
    }
  }
  console.log(`✓ Line Items synced: ${lineItemsCreated} created.`);
  console.log(`✓ Construction Items (Pricing Grid) synced: ${constructionItemsCreated} created.`);

  // 3. Price Book Entries
  let pbCreated = 0;
  for (const item of customMasterData) {
    let pbe = await PriceBookEntry.findOne({ where: { sku: item.sku } });
    if (!pbe) {
      await PriceBookEntry.create({
        id: crypto.randomUUID(),
        sku: item.sku,
        name: item.lineItem,
        category: item.category,
        unitPrice: item.rate,
        minPrice: Math.round(item.rate * 0.85),
        maxPrice: Math.round(item.rate * 1.15),
        description: `Unit: ${item.unit} | Estimated Rate: ₹${item.rate.toLocaleString('en-IN')}`
      });
      pbCreated++;
    } else {
      await pbe.update({
        unitPrice: item.rate,
        minPrice: Math.round(item.rate * 0.85),
        maxPrice: Math.round(item.rate * 1.15),
        category: item.category,
        name: item.lineItem
      });
    }
  }
  console.log(`✓ Price Book Entries synced: ${pbCreated} created.`);

  // Final verification
  const reqCount = await Requirement.count();
  const liCount = await LineItem.count();
  const ciCount = await ConstructionItem.count();
  const pbCount = await PriceBookEntry.count();

  console.log("\n==========================================");
  console.log("MASTER DATA & PRICING GRID STATUS:");
  console.log(`- Requirements/Categories: ${reqCount}`);
  console.log(`- Line Items (BOM): ${liCount}`);
  console.log(`- Construction Items (Pricing Grid): ${ciCount}`);
  console.log(`- Price Book Entries: ${pbCount}`);
  console.log("==========================================");
}

main().then(() => {
  console.log("Done!");
  process.exit(0);
}).catch(err => {
  console.error("Error syncing master data:", err);
  process.exit(1);
});
