import { sequelize, Requirement, LineItem, PriceBookEntry, ProjectSiteLocation } from "@nexus-crm/database";
import fs from "fs";
import path from "path";
import { DEFAULT_SAUDI_LOCATIONS } from "../controllers/projectLocationController";

export async function seedFaceMasterData() {
  console.log("Starting FACE Master Data Seeding...");

  // 1. Seed Project Site Locations
  if (sequelize.models.ProjectSiteLocation) {
    await sequelize.models.ProjectSiteLocation.sync();
    for (const loc of DEFAULT_SAUDI_LOCATIONS) {
      const existing = await ProjectSiteLocation.findOne({ where: { name: loc.name } });
      if (!existing) {
        await ProjectSiteLocation.create(loc);
        console.log(`[Location] Created: ${loc.name}`);
      } else {
        await existing.update(loc);
      }
    }
  }

  // 2. Load 11 Categories & 51 Line Items
  const jsonPath = "/tmp/face_masters.json";
  if (!fs.existsSync(jsonPath)) {
    console.error("Master json not found at", jsonPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const { cats, items } = data;

  // Map category ID to created Requirement model ID
  const catReqMap = new Map<string, string>();

  // Seed Requirements (Service Categories)
  for (const cat of cats) {
    let req = await Requirement.findOne({ where: { name: cat.name } });
    if (!req) {
      req = await Requirement.create({
        name: cat.name,
        category: cat.ent || "FACEC",
        description: `${cat.desc} (Typical billing: ${cat.bill}. Legal entity: ${cat.ent})`,
        isActive: true
      });
      console.log(`[Category] Created: ${cat.name} (${cat.id})`);
    } else {
      await req.update({
        category: cat.ent || "FACEC",
        description: `${cat.desc} (Typical billing: ${cat.bill}. Legal entity: ${cat.ent})`,
        isActive: true
      });
    }
    catReqMap.set(cat.id, req.id);
  }

  // Seed 51 Line Items into LineItem and PriceBookEntry
  for (const it of items) {
    const [
      itemId,
      catId,
      subCat,
      quoteCode,
      codeStatus,
      description,
      uom,
      billingBasis,
      minBilling,
      rate,
      lowRate,
      highRate
    ] = it;

    const reqId = catReqMap.get(catId);
    const catObj = cats.find((c: any) => c.id === catId);
    const categoryName = catObj ? catObj.name : "Industrial Services";

    // 2a. LineItem table
    if (reqId) {
      const existingLI = await LineItem.findOne({ where: { name: description } });
      if (!existingLI) {
        await LineItem.create({
          requirementId: reqId,
          name: description,
          unit: uom.toLowerCase(),
          description: `Code: ${quoteCode} | Sub-cat: ${subCat} | Billing: ${billingBasis} ${minBilling ? `| Min: ${minBilling}` : ""}`,
          defaultQuantity: 1,
          price: rate,
          unitCost: Math.round(rate * 0.7) // 30% baseline gross margin
        });
      }
    }

    // 2b. PriceBookEntry (Catalog)
    const sku = itemId; // e.g. "LI-001"
    const existingPBE = await PriceBookEntry.findOne({ where: { sku } });
    const pbePayload = {
      sku,
      name: `${subCat} - ${description.slice(0, 70)}`,
      description: `${description}\n• Quote Code: ${quoteCode}\n• Billing Basis: ${billingBasis}\n• Min Billing: ${minBilling || "None"}\n• Sub-Category: ${subCat}`,
      unitPrice: rate,
      category: categoryName,
      minPrice: lowRate || rate,
      maxPrice: highRate || rate,
      segmentPricing: JSON.stringify({
        subCategory: subCat,
        quoteCode,
        uom,
        billingBasis,
        minBilling: minBilling || null,
        faceCategory: catId,
        legalEntity: catObj?.ent || "FACEC"
      })
    };

    if (!existingPBE) {
      await PriceBookEntry.create(pbePayload);
      console.log(`[Catalog Item] Created: ${sku} - ${pbePayload.name}`);
    } else {
      await existingPBE.update(pbePayload);
    }
  }

  console.log(`✅ Successfully seeded: ${cats.length} Categories, ${items.length} Line Items, and ${DEFAULT_SAUDI_LOCATIONS.length} Project Sites.`);
}

if (require.main === module) {
  seedFaceMasterData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
