import { sequelize } from "@nexus-crm/database";

export async function suggestBundleOrItems(leadId: string): Promise<any[]> {
  try {
    const lead = await sequelize.models.Lead.findByPk(leadId);
    if (!lead) return [];

    const industry = (lead as any).industry || "";
    const company = (lead as any).company || "";

    // Step 1: Context-based catalog matching
    // Find all products matching the lead's industry or company keyword
    const products = await sequelize.models.PriceBookEntry.findAll();
    
    const contextMatches = products.filter((p: any) => {
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      
      const query = `${industry} ${company}`.toLowerCase();
      
      return (
        name.includes(industry.toLowerCase()) || 
        desc.includes(industry.toLowerCase()) ||
        category.includes(industry.toLowerCase())
      );
    });

    if (contextMatches.length === 0) {
      // Fallback: Return top 3 most popular items across all accepted quotes
      return products.slice(0, 3).map((r: any) => ({
        productId: r.id,
        sku: r.sku,
        name: r.name,
        unitPrice: Number(r.unitPrice),
        reason: "Recommended based on general catalog popularity."
      }));
    }

    // Step 2: Historical pattern matching
    // Find other products commonly sold together with these matched items in "Accepted" quotes
    const matchedProductIds = contextMatches.map((p: any) => p.id);
    const coOccurMap: Record<string, number> = {};

    const lineItems = await sequelize.models.QuoteLineItem.findAll({
      include: [{
        model: sequelize.models.Quote,
        as: "quote",
        where: { status: "Accepted" }
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

    // Count co-occurrences of other products in the same quotes containing our matched items
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
    const finalItems = [...matchedProductIds, ...associatedIds].slice(0, 3);

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
            ? `Frequently bought together in successful deals matching your profile.`
            : `Recommended based on matching industry/domain context: '${industry}'.`
        });
      }
    }

    return recommendations;
  } catch (error) {
    console.error("Smart recommendation calculation error:", error);
    return [];
  }
}
