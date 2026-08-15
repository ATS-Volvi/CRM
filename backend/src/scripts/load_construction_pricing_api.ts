import { customMasterData } from "../mockData/customMasterData";

const BASE_URL = process.env.API_BASE_URL || "https://crm-k8g4.onrender.com/api/v1";

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@nexus.com", password: "password123" })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.statusText}`);
  const data: any = await res.json();
  return data.token;
}

export async function loadConstructionPricingViaAPI() {
  console.log(`[PRICING SYNC] Connecting to REST API: ${BASE_URL}...`);
  const token = await login();
  console.log(`[PRICING SYNC] Logged in successfully.`);

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // 1. GET Current Line Items to map IDs
  const lineRes = await fetch(`${BASE_URL}/master-data/line-items`, { headers });
  const lineItems: any[] = await lineRes.json();
  console.log(`[PRICING SYNC] Retrieved ${lineItems.length} LineItems from database.`);

  // Lookup map: `${category}:::${lineItemName}:::${unit}` -> lineItemId
  const lineItemMap = new Map<string, string>();
  for (const li of lineItems) {
    const cat = li.requirement?.name || "";
    const key = `${cat.trim().toLowerCase()}:::${li.name.trim().toLowerCase()}:::${li.unit.trim().toLowerCase()}`;
    lineItemMap.set(key, li.id);
  }

  // 2. GET Current Construction Items
  const existingCiRes = await fetch(`${BASE_URL}/master-data/construction-items`, { headers });
  const existingCis: any[] = await existingCiRes.json();
  console.log(`[PRICING SYNC] Current ConstructionItems count: ${existingCis.length}`);

  const existingCiByLineItemId = new Map<string, any>();
  existingCis.forEach(ci => existingCiByLineItemId.set(ci.lineItemId, ci));

  // 3. Create ConstructionItems for all 215 items
  console.log(`[PRICING SYNC] Loading ${customMasterData.length} Construction Items & Pricing...`);
  let createdCount = 0;
  let skippedCount = 0;

  for (const item of customMasterData) {
    const key = `${item.category.trim().toLowerCase()}:::${item.lineItem.trim().toLowerCase()}:::${item.unit.trim().toLowerCase()}`;
    const lineItemId = lineItemMap.get(key);

    if (!lineItemId) {
      console.error(`[PRICING SYNC] LineItem not found for key: "${key}" (Row ${item.sNo})`);
      continue;
    }

    if (existingCiByLineItemId.has(lineItemId)) {
      skippedCount++;
      continue;
    }

    const payload = {
      lineItemId,
      name: item.lineItem,
      category: "material", // default enum per spec
      unit: item.unit,
      quantityPerLineItem: 1,
      unitCost: item.rate,   // set equal to Estimated Rate
      unitPrice: item.rate,  // set equal to Estimated Rate
      isActive: true
    };

    const createRes = await fetch(`${BASE_URL}/master-data/construction-items`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (createRes.ok) {
      createdCount++;
      existingCiByLineItemId.set(lineItemId, true);
    } else {
      console.error(`[PRICING SYNC] Failed to create ConstructionItem for "${item.lineItem}":`, await createRes.text());
    }
  }

  console.log(`[PRICING SYNC] ConstructionItems load complete. Created: ${createdCount}, Skipped: ${skippedCount}`);

  // 4. Also ensure PriceBookEntries exist for all 215 items
  const pbRes = await fetch(`${BASE_URL}/price-book`, { headers });
  const existingPb: any[] = await pbRes.json();
  const existingPbSkus = new Set(existingPb.map(p => p.sku));

  let pbCreated = 0;
  for (const item of customMasterData) {
    if (existingPbSkus.has(item.sku)) continue;

    const pbPayload = {
      sku: item.sku,
      name: item.lineItem,
      category: item.category,
      unitPrice: item.rate,
      minPrice: Math.round(item.rate * 0.85),
      maxPrice: Math.round(item.rate * 1.15),
      description: `Unit: ${item.unit} | Estimated Rate: ₹${item.rate.toLocaleString('en-IN')}`
    };

    const pbCreateRes = await fetch(`${BASE_URL}/price-book`, {
      method: "POST",
      headers,
      body: JSON.stringify(pbPayload)
    });

    if (pbCreateRes.ok) {
      pbCreated++;
      existingPbSkus.add(item.sku);
    }
  }
  console.log(`[PRICING SYNC] PriceBookEntries load complete. Created: ${pbCreated}`);

  // 5. Final Verification GET
  const finalCiRes = await fetch(`${BASE_URL}/master-data/construction-items`, { headers });
  const finalCis: any[] = await finalCiRes.json();

  const finalGridRes = await fetch(`${BASE_URL}/master-data/pricing`, { headers });
  const finalGrid: any[] = await finalGridRes.json();

  const finalPbRes = await fetch(`${BASE_URL}/price-book`, { headers });
  const finalPb: any[] = await finalPbRes.json();

  console.log(`\n=== FINAL PRICING VERIFICATION ===`);
  console.log(`Total Construction Items: ${finalCis.length} (Expected: 215)`);
  console.log(`Total Pricing Grid Rows: ${finalGrid.length} (Expected: 215)`);
  console.log(`Total Price Book Products: ${finalPb.length} (Expected: 215)`);

  return {
    constructionItemsCount: finalCis.length,
    pricingGridCount: finalGrid.length,
    priceBookCount: finalPb.length
  };
}

if (require.main === module) {
  loadConstructionPricingViaAPI()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("[FATAL ERROR]", err);
      process.exit(1);
    });
}
