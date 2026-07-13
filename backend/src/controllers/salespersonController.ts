import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getSalespersonsPerformance = async (req: Request, res: Response) => {
  try {
    // 1. Fetch all users who are salespersons
    const users = await sequelize.models.User.findAll({
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads"]
    });

    const salespersonStats = [];

    for (const user of users) {
      const u = user as any;
      // 2. Fetch all leads assigned to this user
      const leads = await sequelize.models.Lead.findAll({
        where: { assignedToId: u.id }
      });

      // 3. Fetch all deals owned by this user
      const deals = await sequelize.models.Deal.findAll({
        where: { ownerId: u.id },
        include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
      });

      // 4. Fetch all quotes of this user's deals
      const dealIds = deals.map((d: any) => d.id);
      let purchaseOrders: any[] = [];
      let wonClients: any[] = [];

      if (dealIds.length > 0) {
        const quotes = await sequelize.models.Quote.findAll({
          where: { dealId: dealIds },
          include: [{ model: sequelize.models.PurchaseOrder, as: "PurchaseOrder" }]
        });

        // Extract purchase orders
        quotes.forEach((q: any) => {
          if (q.PurchaseOrder) {
            purchaseOrders.push({
              id: q.PurchaseOrder.id,
              poNumber: q.PurchaseOrder.poNumber,
              amount: q.PurchaseOrder.amount,
              status: q.PurchaseOrder.status,
              createdAt: q.PurchaseOrder.createdAt
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
        id: u.id,
        name: u.name,
        role: u.role,
        isAvailable: u.isAvailable,
        maxOpenLeads: u.maxOpenLeads,
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

export const getSalespersonPerformanceDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Fetch user (salesperson)
    const user = await sequelize.models.User.findByPk(id as string, {
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads"]
    });
    if (!user) {
      return res.status(404).json({ error: "Salesperson not found" });
    }
    const u = user as any;

    // 2. Fetch all leads assigned to this user
    const leads = await sequelize.models.Lead.findAll({
      where: { assignedToId: u.id }
    });

    // 3. Fetch all deals owned by this user, including their pipeline stage and lead
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: u.id },
      include: [
        { model: sequelize.models.PipelineStage, as: "stage" },
        { model: sequelize.models.Lead, as: "lead" }
      ]
    });

    // 4. Fetch all quotes of this user's deals
    const dealIds = deals.map((d: any) => d.id);
    let purchaseOrders: any[] = [];
    let wonClients: any[] = [];
    let quotes: any[] = [];

    if (dealIds.length > 0) {
      quotes = await sequelize.models.Quote.findAll({
        where: { dealId: dealIds },
        include: [{ model: sequelize.models.PurchaseOrder, as: "PurchaseOrder" }]
      });

      // Extract purchase orders
      quotes.forEach((q: any) => {
        if (q.PurchaseOrder) {
          purchaseOrders.push({
            id: q.PurchaseOrder.id,
            poNumber: q.PurchaseOrder.poNumber,
            amount: Number(q.PurchaseOrder.amount),
            status: q.PurchaseOrder.status,
            createdAt: q.PurchaseOrder.createdAt
          });
        }
      });

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

    // Deal stages
    const dealTypeMap: Record<string, number> = {};
    deals.forEach((d: any) => {
      const stageName = d.stage?.name || "Draft";
      dealTypeMap[stageName] = (dealTypeMap[stageName] || 0) + 1;
    });
    const dealTypes = Object.keys(dealTypeMap).map(name => ({
      stage: name,
      count: dealTypeMap[name]
    }));

    // 5. Build wonLeads and lostLeads arrays
    const wonLeads: any[] = [];
    const lostLeads: any[] = [];
    
    // Group closed (won/lost) counts by source for sourceBreakdown
    const sourceStats: Record<string, { totalClosed: number; won: number }> = {};

    deals.forEach((d: any) => {
      const stageName = d.stage?.name;
      if (stageName === "Won" || stageName === "Lost") {
        const lead = d.lead;
        const sourceVal = lead?.source || "Website";
        
        if (!sourceStats[sourceVal]) {
          sourceStats[sourceVal] = { totalClosed: 0, won: 0 };
        }
        sourceStats[sourceVal].totalClosed++;

        const leadEntry = {
          id: lead?.id || d.id, // Fallback if no leadId
          name: lead ? `${lead.firstName} ${lead.lastName}` : d.name,
          company: lead?.company || "N/A",
          dealValue: Number(d.amount),
          closeDate: d.updatedAt,
          source: sourceVal
        };

        if (stageName === "Won") {
          wonLeads.push(leadEntry);
          sourceStats[sourceVal].won++;
        } else {
          lostLeads.push(leadEntry);
        }
      }
    });

    const totalClosed = wonLeads.length + lostLeads.length;
    const successRate = totalClosed > 0 ? wonLeads.length / totalClosed : 0;

    // 6. Build sourceBreakdown
    const sourceBreakdown: Record<string, { total: number; won: number; winRate: number }> = {};
    Object.keys(sourceStats).forEach(src => {
      const stats = sourceStats[src];
      sourceBreakdown[src] = {
        total: stats.totalClosed,
        won: stats.won,
        winRate: stats.totalClosed > 0 ? stats.won / stats.totalClosed : 0
      };
    });

    // 7. bestFitSuggestion
    let bestFitSuggestion: any = null;
    let maxWinRate = -1;
    let bestSource: string | null = null;

    Object.keys(sourceBreakdown).forEach(src => {
      const item = sourceBreakdown[src];
      if (item.total >= 5) {
        if (item.winRate > maxWinRate) {
          maxWinRate = item.winRate;
          bestSource = src;
        }
      }
    });

    if (bestSource) {
      bestFitSuggestion = {
        source: bestSource,
        winRate: Math.round(maxWinRate * 100)
      };
    } else {
      bestFitSuggestion = {
        source: null,
        winRate: null,
        reason: "insufficient closed deals to recommend"
      };
    }

    // 8. Fetch Activities
    const activitiesData = await sequelize.models.Activity.findAll({
      where: { createdById: u.id },
      include: [{ model: sequelize.models.Lead }],
      order: [["createdAt", "DESC"]]
    });

    const activities = activitiesData.map((act: any) => ({
      id: act.id,
      type: act.type,
      outcome: act.outcome,
      createdAt: act.createdAt,
      leadId: act.leadId,
      leadName: act.Lead ? `${act.Lead.firstName} ${act.Lead.lastName}` : null,
      pinned: act.pinned || false,
      priority: act.priority
    }));

    res.json({
      id: u.id,
      name: u.name,
      role: u.role,
      isAvailable: u.isAvailable,
      maxOpenLeads: u.maxOpenLeads,
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
      dealTypes,
      quotes: quotes.map((q: any) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        version: q.version,
        status: q.status,
        cycleStage: q.status,
        totalAmount: Number(q.totalAmount),
        dealId: q.dealId,
        dealName: (deals.find((d: any) => d.id === q.dealId) as any)?.name || "",
        createdAt: q.createdAt,
        sentAt: q.sentAt,
        viewedAt: q.viewedAt,
        acceptedAt: q.acceptedAt,
        expirationDate: q.expirationDate,
        approvalStatus: null,
        approvalComments: null,
        approvedBy: null
      })),
      activities,
      wonLeads,
      lostLeads,
      successRate,
      sourceBreakdown,
      bestFitSuggestion
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
