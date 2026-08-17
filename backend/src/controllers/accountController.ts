import { Request, Response } from "express";
import { sequelize, Account, Contact, Deal, Quote, PurchaseOrder, Activity } from "@nexus-crm/database";

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const { Op } = require("sequelize");
    const where: any = {};

    if (search) {
      const searchStr = `%${search}%`;
      where[Op.or] = [
        { name: { [Op.like]: searchStr } },
        { email: { [Op.like]: searchStr } },
        { phone: { [Op.like]: searchStr } },
        { industry: { [Op.like]: searchStr } }
      ];
    }

    const accounts = await Account.findAll({
      where,
      include: [
        { model: Contact, as: "contacts" },
        {
          model: Deal,
          as: "deals",
          include: [{ model: Quote, as: "quotes" }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });
    return res.status(200).json(accounts);
  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id, {
      include: [
        { model: Contact, as: "contacts" },
        { 
          model: Deal, 
          as: "deals",
          include: [{ model: Quote, as: "quotes" }]
        }
      ]
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Fetch account-associated activities
    const activities = await Activity.findAll({
      where: {
        customerId: id
      },
      order: [["createdAt", "DESC"]]
    });

    // Fetch account-associated purchase orders through quotes/deals
    const dealIds = (account as any).deals?.map((d: any) => d.id) || [];
    let quotesForDeals: any[] = [];
    if (dealIds.length > 0) {
      quotesForDeals = await Quote.findAll({
        where: { dealId: dealIds }
      });
    }
    const quoteIds = quotesForDeals.map((q: any) => q.id);
    let orders: any[] = [];
    if (quoteIds.length > 0) {
      orders = await PurchaseOrder.findAll({
        where: { quoteId: quoteIds }
      });
    }

    const accountData = account.toJSON();
    (accountData as any).quotes = quotesForDeals;
    (accountData as any).purchaseOrders = orders;
    (accountData as any).orders = orders;
    (accountData as any).activities = activities;

    return res.status(200).json(accountData);
  } catch (error: any) {
    console.error("Error fetching account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

