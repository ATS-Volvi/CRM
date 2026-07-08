import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getSalespersonsPerformance = async (req: Request, res: Response) => {
  try {
    // 1. Fetch all users who are salespersons
    const users = await sequelize.models.User.findAll({
      attributes: ["id", "username", "role", "isAvailable", "maxOpenLeads"]
    });

    const salespersonStats = [];

    for (const user of users) {
      // 2. Fetch all leads assigned to this user
      const leads = await sequelize.models.Lead.findAll({
        where: { assignedToId: user.id }
      });

      // 3. Fetch all deals owned by this user
      const deals = await sequelize.models.Deal.findAll({
        where: { ownerId: user.id },
        include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
      });

      // 4. Fetch all quotes of this user's deals
      const dealIds = deals.map((d: any) => d.id);
      let purchaseOrders: any[] = [];
      let wonClients: any[] = [];

      if (dealIds.length > 0) {
        const quotes = await sequelize.models.Quote.findAll({
          where: { dealId: dealIds },
          include: [{ model: sequelize.models.PurchaseOrder, as: "purchaseOrder" }]
        });

        // Extract purchase orders
        quotes.forEach((q: any) => {
          if (q.purchaseOrder) {
            purchaseOrders.push({
              id: q.purchaseOrder.id,
              poNumber: q.purchaseOrder.poNumber,
              amount: q.purchaseOrder.amount,
              status: q.purchaseOrder.status,
              createdAt: q.purchaseOrder.createdAt
            });
          }
        });

        // Old won clients
        wonClients = leads.filter((l: any) => l.status === "Qualified" || l.status === "Contacted");
      }

      // Lead sources distribution
      const sourceMap: Record<string, number> = {};
      leads.forEach((l: any) => {
        const src = l.source || "Unknown";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      const leadSources = Object.keys(sourceMap).map(name => ({
        source: name,
        count: sourceMap[name]
      }));

      // Deal types (e.g. Won vs On Hold vs Proposal)
      const dealTypeMap: Record<string, number> = {};
      deals.forEach((d: any) => {
        const stageName = d.stage?.name || "Draft";
        dealTypeMap[stageName] = (dealTypeMap[stageName] || 0) + 1;
      });
      const dealTypes = Object.keys(dealTypeMap).map(name => ({
        stage: name,
        count: dealTypeMap[name]
      }));

      salespersonStats.push({
        id: user.id,
        name: user.username,
        role: user.role,
        isAvailable: user.isAvailable,
        maxOpenLeads: user.maxOpenLeads,
        totalLeads: leads.length,
        totalDeals: deals.length,
        purchaseOrders,
        wonClients: wonClients.map((c: any) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          company: c.company || "N/A",
          email: c.email,
          status: c.status
        })),
        leadSources,
        dealTypes
      });
    }

    res.json(salespersonStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
