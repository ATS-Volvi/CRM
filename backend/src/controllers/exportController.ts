import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const exportLeads = async (req: Request, res: Response) => {
  try {
    const leads = await sequelize.models.Lead.findAll();
    
    let csv = "First Name,Last Name,Company,Email,Phone,Status,Source,Score\n";
    leads.forEach((l: any) => {
      csv += `"${l.firstName}","${l.lastName}","${l.company || ""}","${l.email}","${l.phone || ""}","${l.status}","${l.source || ""}","${l.leadScore || 50}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads_export.csv");
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportQuotes = async (req: Request, res: Response) => {
  try {
    const { search, status, startDate, endDate, salespersonId, category, valueBand } = req.query;
    const { Op } = require("sequelize");

    const where: any = {};
    if (status && status !== "All Statuses" && status !== "All") {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    if (valueBand) {
      if (valueBand === "low") {
        where.totalAmount = { [Op.lte]: 10000 };
      } else if (valueBand === "medium") {
        where.totalAmount = { [Op.gt]: 10000, [Op.lte]: 50000 };
      } else if (valueBand === "high") {
        where.totalAmount = { [Op.gt]: 50000 };
      }
    }

    const dealWhere: any = {};
    if (salespersonId) {
      dealWhere.ownerId = salespersonId;
    }

    const leadWhere: any = {};
    if (search) {
      const searchStr = `%${search}%`;
      leadWhere[Op.or] = [
        { firstName: { [Op.like]: searchStr } },
        { lastName: { [Op.like]: searchStr } },
        { company: { [Op.like]: searchStr } }
      ];
    }

    const lineItemInclude: any = {
      model: sequelize.models.QuoteLineItem,
      as: "QuoteLineItems",
      include: []
    };

    if (category) {
      lineItemInclude.include.push({
        model: sequelize.models.PriceBookEntry,
        as: "product",
        where: { category }
      });
    } else {
      lineItemInclude.include.push({
        model: sequelize.models.PriceBookEntry,
        as: "product"
      });
    }

    const quotes = await sequelize.models.Quote.findAll({
      where,
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          where: Object.keys(dealWhere).length > 0 ? dealWhere : undefined,
          include: [
            {
              model: sequelize.models.Lead,
              as: "lead",
              where: Object.keys(leadWhere).length > 0 ? leadWhere : undefined
            }
          ]
        },
        lineItemInclude
      ],
      order: [['createdAt', 'DESC']]
    });

    let filteredQuotes = quotes;
    if (search) {
      const searchLower = String(search).toLowerCase();
      filteredQuotes = quotes.filter((q: any) => {
        const matchesNum = q.quoteNumber && q.quoteNumber.toLowerCase().includes(searchLower);
        const matchesLead = q.deal && q.deal.lead;
        return matchesNum || matchesLead;
      });
    }

    if (category) {
      filteredQuotes = filteredQuotes.filter((q: any) => {
        return q.QuoteLineItems && q.QuoteLineItems.some((li: any) => li.product);
      });
    }
    
    let csv = "Quote Number,Version,Status,Total Amount,Expiration Date\n";
    filteredQuotes.forEach((q: any) => {
      csv += `"${q.quoteNumber || ""}","${q.version || 1}","${q.status}","${Number(q.totalAmount || 0).toFixed(2)}","${q.expirationDate ? new Date(q.expirationDate).toLocaleDateString() : ""}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=quotes_export.csv");
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { search, salespersonId, startDate, endDate, valueBand } = req.query;
    const { Op } = require("sequelize");

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate as string);
      }
    }

    if (valueBand) {
      if (valueBand === "low") {
        where.amount = { [Op.lte]: 10000 };
      } else if (valueBand === "medium") {
        where.amount = { [Op.gt]: 10000, [Op.lte]: 50000 };
      } else if (valueBand === "high") {
        where.amount = { [Op.gt]: 50000 };
      }
    }

    const dealWhere: any = {};
    if (salespersonId) {
      dealWhere.ownerId = salespersonId;
    }

    const leadWhere: any = {};
    if (search) {
      const searchStr = `%${search}%`;
      leadWhere[Op.or] = [
        { firstName: { [Op.like]: searchStr } },
        { lastName: { [Op.like]: searchStr } },
        { company: { [Op.like]: searchStr } }
      ];
    }

    const pos = await sequelize.models.PurchaseOrder.findAll({
      where,
      include: [
        { 
          model: sequelize.models.Quote, 
          as: "quote", 
          include: [{ 
            model: sequelize.models.Deal, 
            as: "deal",
            where: Object.keys(dealWhere).length > 0 ? dealWhere : undefined,
            include: [
              {
                model: sequelize.models.Lead,
                as: "lead",
                where: Object.keys(leadWhere).length > 0 ? leadWhere : undefined
              }
            ] 
          }] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    let filteredPos = pos;
    if (search) {
      const searchLower = String(search).toLowerCase();
      filteredPos = pos.filter((p: any) => {
        const matchesPO = p.poNumber && p.poNumber.toLowerCase().includes(searchLower);
        const matchesLead = p.quote?.deal?.lead;
        return matchesPO || matchesLead;
      });
    }
    
    let csv = "PO Number,Amount,Status,Generated Date\n";
    filteredPos.forEach((p: any) => {
      csv += `"${p.poNumber}","${Number(p.amount).toFixed(2)}","${p.status}","${new Date(p.createdAt).toLocaleDateString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=purchase_orders_export.csv");
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
