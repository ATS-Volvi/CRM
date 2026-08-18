import { customMasterData } from "../mockData/customMasterData";

const BASE_URL = process.env.API_BASE_URL || "https://crm-k8g4.onrender.com/api/v1";

interface RequirementPayload {
  id?: string;
  name: string;
  category: string;
  description?: string;
  isActive: boolean;
}

interface LineItemPayload {
  requirementId: string;
  name: string;
  unit: string;
  description?: string;
  defaultQuantity?: number;
}

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

export async function syncMasterDataViaAPI() {
  console.log(`[API SYNC] Connecting to REST API: ${BASE_URL}...`);
  const token = await login();
  console.log(`[API SYNC] Logged in successfully as admin.`);

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // 1. GET Current Requirements & Line Items
  const reqRes = await fetch(`${BASE_URL}/master-data/requirements`, { headers });
  const currentReqs: any[] = await reqRes.json();

  const lineRes = await fetch(`${BASE_URL}/master-data/line-items`, { headers });
  const currentLines: any[] = await lineRes.json();

  console.log(`[API SYNC] Current state: ${currentReqs.length} Requirements, ${currentLines.length} LineItems.`);

  // 2. Delete Demo Requirements if they match old demo names
  const demoNames = [
    "High-Security Defense & Healthcare Spec",
    "Standard Enterprise Deployment"
  ];
  for (const req of currentReqs) {
    if (demoNames.includes(req.name)) {
      console.log(`[API SYNC] Deleting demo requirement via REST API: "${req.name}" (${req.id})...`);
      const delRes = await fetch(`${BASE_URL}/master-data/requirements/${req.id}`, {
        method: "DELETE",
        headers
      });
      if (delRes.ok) {
        console.log(`[API SYNC] Deleted "${req.name}" and cascading line items.`);
      } else {
        console.error(`[API SYNC] Failed to delete "${req.name}":`, await delRes.text());
      }
    }
  }

  // 3. Re-fetch current requirements to build map
  const updatedReqRes = await fetch(`${BASE_URL}/master-data/requirements`, { headers });
  const activeReqs: any[] = await updatedReqRes.json();
  const reqMap = new Map<string, string>(); // categoryName -> requirementId
  activeReqs.forEach(r => reqMap.set(r.name, r.id));

  // 4. Create missing Requirements (Idempotent)
  const uniqueCategories = Array.from(new Set(customMasterData.map(item => item.category)));
  console.log(`[API SYNC] Ensuring ${uniqueCategories.length} Requirements exist...`);

  for (const catName of uniqueCategories) {
    if (!reqMap.has(catName)) {
      const createRes = await fetch(`${BASE_URL}/master-data/requirements`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: catName,
          category: catName,
          description: `Master deliverables & specifications for ${catName}`,
          isActive: true
        })
      });
      if (createRes.ok) {
        const created: any = await createRes.json();
        reqMap.set(catName, created.id);
        console.log(`[API SYNC] Created Requirement: "${catName}" -> ${created.id}`);
      } else {
        console.error(`[API SYNC] Failed to create Requirement "${catName}":`, await createRes.text());
      }
    } else {
      console.log(`[API SYNC] Requirement already exists: "${catName}" -> ${reqMap.get(catName)}`);
    }
  }

  // 5. Fetch all current Line Items to check for duplicates (Idempotent)
  const allLinesRes = await fetch(`${BASE_URL}/master-data/line-items`, { headers });
  const existingLineItems: any[] = await allLinesRes.json();
  const existingLineKeys = new Set(
    existingLineItems.map(l => `${l.requirementId}_${l.name.toLowerCase()}`)
  );

  // 6. Create all 215 Line Items
  console.log(`[API SYNC] Loading ${customMasterData.length} Line Items via REST API...`);
  let createdCount = 0;
  let skippedCount = 0;

  for (const item of customMasterData) {
    const requirementId = reqMap.get(item.category);
    if (!requirementId) {
      console.error(`[API SYNC] Missing requirement ID for category: "${item.category}"`);
      continue;
    }

    const key = `${requirementId}_${item.lineItem.toLowerCase()}`;
    if (existingLineKeys.has(key)) {
      skippedCount++;
      continue;
    }

    const linePayload: LineItemPayload = {
      requirementId,
      name: item.lineItem,
      unit: item.unit,
      description: `${item.category} - ${item.lineItem} (${item.unit})`,
      defaultQuantity: 1
    };

    const lineCreateRes = await fetch(`${BASE_URL}/master-data/line-items`, {
      method: "POST",
      headers,
      body: JSON.stringify(linePayload)
    });

    if (lineCreateRes.ok) {
      createdCount++;
      existingLineKeys.add(key);
    } else {
      console.error(`[API SYNC] Failed to create Line Item "${item.lineItem}":`, await lineCreateRes.text());
    }
  }

  console.log(`[API SYNC] Finished: Created ${createdCount} LineItems, skipped ${skippedCount} existing.`);

  // 7. Verify final counts via GET
  const finalReqRes = await fetch(`${BASE_URL}/master-data/requirements`, { headers });
  const finalReqs: any[] = await finalReqRes.json();

  const finalLinesRes = await fetch(`${BASE_URL}/master-data/line-items`, { headers });
  const finalLines: any[] = await finalLinesRes.json();

  console.log(`\n=== FINAL REST API VERIFICATION ===`);
  console.log(`Total Requirements: ${finalReqs.length} (Expected: ${uniqueCategories.length})`);
  console.log(`Total Line Items: ${finalLines.length} (Expected: ${customMasterData.length})`);

  return {
    requirementsCount: finalReqs.length,
    lineItemsCount: finalLines.length,
    requirements: finalReqs,
    lineItems: finalLines
  };
}

if (require.main === module) {
  syncMasterDataViaAPI()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("[FATAL ERROR]", err);
      process.exit(1);
    });
}
