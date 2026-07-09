import { sequelize } from "@nexus-crm/database";

export async function getPriceWinRateSuggestion(productId: string): Promise<{ suggestedPrice: number; winRateCurve: string }> {
  try {
    // Find all quote line items of this product that belong to a closed quote (either Accepted or Rejected)
    const items = await sequelize.models.QuoteLineItem.findAll({
      where: { productId },
      include: [{ 
        model: sequelize.models.Quote, 
        as: "quote" 
      }]
    });

    if (items.length < 5) {
      // Not enough data yet (requires at least 5 quotes for comparison)
      // Return standard catalog price as fallback
      const product = await sequelize.models.PriceBookEntry.findByPk(productId);
      return {
        suggestedPrice: product ? Number((product as any).unitPrice) : 0,
        winRateCurve: "accumulating"
      };
    }

    // Group wins/losses by unitPrice
    const priceMap: Record<number, { total: number; wins: number }> = {};
    items.forEach((item: any) => {
      const price = Number(item.unitPrice);
      const status = item.quote?.status;

      if (status === "Accepted" || status === "Rejected" || status === "Superseded") {
        if (!priceMap[price]) {
          priceMap[price] = { total: 0, wins: 0 };
        }
        priceMap[price].total++;
        if (status === "Accepted") {
          priceMap[price].wins++;
        }
      }
    });

    const prices = Object.keys(priceMap).map(Number);
    if (prices.length === 0) {
      const product = await sequelize.models.PriceBookEntry.findByPk(productId);
      return {
        suggestedPrice: product ? Number((product as any).unitPrice) : 0,
        winRateCurve: "accumulating"
      };
    }

    // Find price point with highest win rate percentage
    let optimalPrice = prices[0];
    let maxWinRate = 0;

    prices.forEach(price => {
      const rate = priceMap[price].wins / priceMap[price].total;
      if (rate > maxWinRate) {
        maxWinRate = rate;
        optimalPrice = price;
      }
    });

    // Classify win rate curve
    let winRateCurve = "med";
    if (maxWinRate > 0.75) {
      winRateCurve = "high";
    } else if (maxWinRate < 0.25) {
      winRateCurve = "low";
    }

    return {
      suggestedPrice: optimalPrice,
      winRateCurve
    };
  } catch (error) {
    console.error("Pricing win-rate calculation error:", error);
    return { suggestedPrice: 0, winRateCurve: "accumulating" };
  }
}
