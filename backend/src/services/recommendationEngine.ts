import { sequelize } from "@nexus-crm/database";

export async function suggestBundleOrItems(leadId: string): Promise<any[]> {
  try {
    const lead = await sequelize.models.Lead.findByPk(leadId);
    if (!lead) return [];

    const industry = (lead as any).industry || "";
    const company = (lead as any).company || "";
    const rawPayload = (lead as any).rawPayload || "";
    const { Op } = require("sequelize");

    // ── Step 0: categoriesData-first matching ──────────────────
    // If the lead has explicit master-data requirements, use them as the
    // PRIMARY source of recommendation before any generic keyword pass.
    const categoriesData = (lead as any).categoriesData;
    const products = await sequelize.models.PriceBookEntry.findAll();

    if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
      const directRecs: any[] = [];
      const seenProductIds = new Set<string>();

      for (const group of categoriesData) {
        const items = Array.isArray(group.items) ? group.items : [];
        for (const lineItem of items) {
          const itemNameLower = (lineItem.name || "").toLowerCase();
          if (!itemNameLower) continue;

          // Fuzzy match: check if a PriceBookEntry name contains this LineItem name or vice versa
          const nameTokens = itemNameLower.split(/[\s,\-_]+/).filter((t: string) => t.length > 2);
          const match = (products as any[]).find((p: any) => {
            const pNameLower = (p.name || "").toLowerCase();
            return nameTokens.some((token: string) => pNameLower.includes(token)) ||
                   itemNameLower.includes(pNameLower.split(/[\s,\-_]+/).find((t: string) => t.length > 2) || "___NOMATCH___");
          });

          if (match && !seenProductIds.has((match as any).id)) {
            seenProductIds.add((match as any).id);
            directRecs.push({
              productId: (match as any).id,
              sku: (match as any).sku,
              name: (match as any).name,
              unitPrice: Number((match as any).unitPrice),
              quantity: lineItem.quantity || 1,
              reason: `Directly specified in lead requirements: "${group.categoryName}" → "${lineItem.name}".`
            });
          } else if (!match) {
            // No price-book match: surface as a placeholder with zero price so rep knows it needs manual pricing
            directRecs.push({
              productId: null,
              sku: null,
              name: lineItem.name,
              unitPrice: 0,
              quantity: lineItem.quantity || 1,
              reason: `Required by lead (no catalog match yet): "${group.categoryName}" → "${lineItem.name}". Please add price manually.`
            });
          }
        }
      }

      if (directRecs.length > 0) {
        return directRecs;
      }
    }

    // Step 1: Context-based catalog matching (fallback when no categoriesData)
    const query = `${industry} ${company} ${rawPayload}`.toLowerCase();
    const keywords = query.split(/[\s,._\-;:"'()\[\]/]+/).filter(w => w.length > 3);

    const contextMatches = (products as any[]).filter((p: any) => {
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      
      return keywords.some(keyword => 
        name.includes(keyword) || 
        desc.includes(keyword) || 
        category.includes(keyword)
      );
    });

    // Step 2: Historical co-occurrence pattern matching for similar clients (same industry)
    const matchedProductIds = contextMatches.map((p: any) => p.id);
    const coOccurMap: Record<string, number> = {};

    const lineItems = await sequelize.models.QuoteLineItem.findAll({
      include: [{
        model: sequelize.models.Quote,
        as: "quote",
        where: { status: "Accepted" },
        include: [{
          model: sequelize.models.Deal,
          as: "deal",
          include: [{
            model: sequelize.models.Lead,
            as: "lead",
            where: industry ? { industry: { [Op.like]: `%${industry}%` } } : undefined
          }]
        }]
      }]
    });

    // Group items by quoteId
    const quoteGroups: Record<string, string[]> = {};
    (lineItems as any[]).forEach((li: any) => {
      if (!quoteGroups[li.quoteId]) {
        quoteGroups[li.quoteId] = [];
      }
      quoteGroups[li.quoteId].push(li.productId);
    });

    // Count co-occurrences of other products
    Object.values(quoteGroups).forEach(productIds => {
      const containsMatch = productIds.some(pid => matchedProductIds.includes(pid));
      if (containsMatch) {
        productIds.forEach(pid => {
          if (!matchedProductIds.includes(pid)) {
            coOccurMap[pid] = (coOccurMap[pid] || 0) + 1;
          }
        });
      }
    });

    // Sort items by count
    const associatedIds = Object.keys(coOccurMap).sort((a, b) => coOccurMap[b] - coOccurMap[a]);
    const finalItems = [...matchedProductIds, ...associatedIds].slice(0, 5);

    // Map back to catalog products
    const recommendations = [];
    for (const pid of finalItems) {
      const prod = (products as any[]).find((p: any) => p.id === pid);
      if (prod) {
        const isCoOccur = !matchedProductIds.includes(pid);
        recommendations.push({
          productId: (prod as any).id,
          sku: (prod as any).sku,
          name: (prod as any).name,
          unitPrice: Number((prod as any).unitPrice),
          reason: isCoOccur
            ? `Frequently bought together in successful deals for similar ${industry} clients.`
            : `Recommended based on keywords matching lead details.`
        });
      }
    }

    // If still empty, return top 3 most popular items overall
    if (recommendations.length === 0) {
      return (products as any[]).slice(0, 3).map((r: any) => ({
        productId: r.id,
        sku: r.sku,
        name: r.name,
        unitPrice: Number(r.unitPrice),
        reason: "Recommended based on general catalog popularity."
      }));
    }

    return recommendations;
  } catch (error) {
    console.error("Smart recommendation calculation error:", error);
    return [];
  }
}
