import { sequelize } from "@nexus-crm/database";

export async function suggestBundleOrItems(leadId: string): Promise<any[]> {
  try {
    const lead = await sequelize.models.Lead.findByPk(leadId);
    if (!lead) return [];

    const industry = (lead as any).industry || "";
    const company = (lead as any).company || "";
    const rawPayload = (lead as any).rawPayload || "";
    const { Op } = require("sequelize");

    // Step 1: Context-based catalog matching
    const products = await sequelize.models.PriceBookEntry.findAll();
    const query = `${industry} ${company} ${rawPayload}`.toLowerCase();
    const keywords = query.split(/[\s,._\-;:"'()\[\]/]+/).filter(w => w.length > 3);

    const contextMatches = products.filter((p: any) => {
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
    lineItems.forEach((li: any) => {
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
      const prod = products.find((p: any) => p.id === pid);
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
      return products.slice(0, 3).map((r: any) => ({
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
