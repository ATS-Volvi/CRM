import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({
        leads: [], accounts: [], contacts: [], opportunities: [], deals: [], quotes: [], orders: [],
        tasks: [], meetings: [], salespersons: [], calls: []
      });
    }

    const likeQuery = `%${q}%`;
    const models = sequelize.models;

    const [leads, accounts, contacts, deals, quotes, orders, tasks, users, assetsRes] = await Promise.all([
      models.Lead.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.like]: likeQuery } },
            { lastName: { [Op.like]: likeQuery } },
            { company: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "firstName", "lastName", "company", "email", "status", "leadScore"]
      }),
      models.Account ? models.Account.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } },
            { primaryContactName: { [Op.like]: likeQuery } },
            { industry: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "name", "email", "primaryContactName", "industry", "phone"]
      }) : Promise.resolve([]),
      models.Contact ? models.Contact.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.like]: likeQuery } },
            { lastName: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } },
            { phone: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "firstName", "lastName", "email", "phone", "role", "accountId"]
      }) : Promise.resolve([]),
      models.Deal.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "name", "amount", "stageId", "accountId"]
      }),
      models.Quote.findAll({
        where: {
          [Op.or]: [
            { quoteNumber: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "quoteNumber", "totalAmount", "status", "version", "dealId"]
      }),
      models.PurchaseOrder ? models.PurchaseOrder.findAll({
        where: {
          [Op.or]: [
            { poNumber: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "poNumber", "amount", "status", "quoteId"]
      }) : Promise.resolve([]),
      models.Task.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "title", "priority", "dueDate"]
      }),
      models.User.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } },
            { department: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "name", "email", "role", "department", "territory"]
      }),
      models.Asset ? models.Asset.findAll({
        where: {
          [Op.or]: [
            { assetNumber: { [Op.like]: likeQuery } },
            { name: { [Op.like]: likeQuery } },
            { serialNumber: { [Op.like]: likeQuery } }
          ]
        },
        limit: 10,
        attributes: ["id", "assetNumber", "name", "serialNumber", "status", "accountId", "orderId"]
      }) : Promise.resolve([])
    ]);

    const assets = (assetsRes || []).map((a: any) => ({ ...a.toJSON(), entityType: "ASSET" }));

    res.json({
      leads: leads.map(l => ({ ...l.toJSON(), entityType: "LEAD" })),
      accounts: accounts.map(a => ({ ...a.toJSON(), entityType: "ACCOUNT" })),
      contacts: contacts.map(c => ({ ...c.toJSON(), entityType: "CONTACT" })),
      opportunities: deals.map(d => ({ ...d.toJSON(), entityType: "OPPORTUNITY" })),
      deals: deals.map(d => ({ ...d.toJSON(), entityType: "OPPORTUNITY" })),
      quotes: quotes.map(q => ({ ...q.toJSON(), entityType: "QUOTE" })),
      orders: orders.map(o => ({ ...o.toJSON(), entityType: "ORDER" })),
      assets,
      tasks,
      salespersons: users
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

