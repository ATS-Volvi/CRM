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

    const mappedAccounts = accounts.map((acc: any) => {
      const data = acc.toJSON();
      data.deals = data.deals || [];
      return data;
    });

    return res.status(200).json(mappedAccounts);
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

    // Fetch account-associated historical leads
    const { Op } = require("sequelize");
    const orConditions: any[] = [{ convertedAccountId: id }];
    if (account.name) orConditions.push({ company: { [Op.like]: `%${account.name}%` } });
    if (account.email) orConditions.push({ email: account.email });
    if (account.phone) orConditions.push({ phone: account.phone });

    let relatedLeads: any[] = [];
    if (sequelize.models.Lead) {
      relatedLeads = await (sequelize.models.Lead as any).findAll({
        where: { [Op.or]: orConditions },
        order: [["createdAt", "DESC"]]
      });
    }

    const accountData = account.toJSON();
    accountData.deals = accountData.deals || [];
    (accountData as any).quotes = quotesForDeals;
    (accountData as any).purchaseOrders = orders;
    (accountData as any).orders = orders;
    (accountData as any).activities = activities;
    (accountData as any).leads = relatedLeads;
    (accountData as any).relatedLeads = relatedLeads;

    return res.status(200).json(accountData);
  } catch (error: any) {
    console.error("Error fetching account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, industry, primaryContactName } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Customer name is required" });
    }

    const newAccount = await Account.create({
      id: require("crypto").randomUUID(),
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      industry: industry || "General",
      primaryContactName: primaryContactName || null
    });

    return res.status(201).json(newAccount);
  } catch (error: any) {
    console.error("Error creating account:", error);
    return res.status(500).json({ error: error.message || "Failed to create account" });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    await account.update(req.body);
    return res.status(200).json(account);
  } catch (error: any) {
    console.error("Error updating account:", error);
    return res.status(500).json({ message: "Failed to update account" });
  }
};

