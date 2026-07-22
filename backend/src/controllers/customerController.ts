import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const Customer = sequelize.models.Customer;
    const customers = await Customer.findAll({
      order: [["name", "ASC"]]
    });
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const Customer = sequelize.models.Customer;
    const customer = await Customer.findByPk(String(id));

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customerJson = customer.toJSON() as any;

    // Fetch associated leads
    customerJson.leads = await sequelize.models.Lead.findAll({
      where: { customerId: id },
      order: [["createdAt", "DESC"]]
    });

    // Fetch associated deals with stage info
    customerJson.deals = await sequelize.models.Deal.findAll({
      where: { customerId: id },
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }],
      order: [["createdAt", "DESC"]]
    });

    const dealIds = customerJson.deals.map((d: any) => d.id);

    // Fetch associated quotes
    if (dealIds.length > 0) {
      customerJson.quotes = await sequelize.models.Quote.findAll({
        where: { dealId: dealIds },
        include: [{ model: sequelize.models.Deal, as: "deal" }],
        order: [["createdAt", "DESC"]]
      });
      
      const quoteIds = customerJson.quotes.map((q: any) => q.id);
      if (quoteIds.length > 0) {
        customerJson.invoices = await sequelize.models.Invoice.findAll({
          where: { quoteId: quoteIds },
          order: [["createdAt", "DESC"]]
        });
        customerJson.purchaseOrders = await sequelize.models.PurchaseOrder.findAll({
          where: { quoteId: quoteIds },
          order: [["createdAt", "DESC"]]
        });
      } else {
        customerJson.invoices = [];
        customerJson.purchaseOrders = [];
      }
    } else {
      customerJson.quotes = [];
      customerJson.invoices = [];
      customerJson.purchaseOrders = [];
    }

    // Fetch all associated activities (calls, meetings, tasks, notes, emails)
    const leadIds = customerJson.leads.map((l: any) => l.id);

    // Activities tied to leads
    customerJson.activities = leadIds.length > 0
      ? await sequelize.models.Activity.findAll({
          where: { leadId: { [Op.in]: leadIds } },
          order: [["createdAt", "DESC"]],
          limit: 50
        })
      : [];

    // Call logs
    try {
      customerJson.callLogs = await sequelize.models.CallLog.findAll({
        where: { customerId: id },
        order: [["createdAt", "DESC"]],
        limit: 20
      });
    } catch { customerJson.callLogs = []; }

    // Meetings
    try {
      customerJson.meetings = await sequelize.models.Meeting.findAll({
        where: { customerId: id },
        order: [["scheduledAt", "DESC"]],
        limit: 20
      });
    } catch { customerJson.meetings = []; }

    // Tasks
    try {
      customerJson.tasks = await sequelize.models.Task.findAll({
        where: { customerId: id },
        order: [["dueDate", "ASC"]]
      });
    } catch { customerJson.tasks = []; }

    // Documents
    try {
      customerJson.documents = await sequelize.models.CrmDocument.findAll({
        where: { customerId: id },
        order: [["createdAt", "DESC"]]
      });
    } catch { customerJson.documents = []; }

    // Email messages
    try {
      customerJson.emailMessages = await sequelize.models.EmailMessage.findAll({
        where: { customerId: id },
        order: [["createdAt", "DESC"]],
        limit: 20
      });
    } catch { customerJson.emailMessages = []; }

    // Computed metrics
    customerJson.lifetimeRevenue = customerJson.invoices.reduce(
      (sum: number, inv: any) => sum + (parseFloat(inv.totalAmount) || parseFloat(inv.amount) || 0), 0
    );
    customerJson.pipelineValue = customerJson.deals
      .filter((d: any) => !["Won", "Lost"].includes(d.stage?.name))
      .reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
    customerJson.openDealsCount = customerJson.deals.filter(
      (d: any) => !["Won", "Lost"].includes(d.stage?.name)
    ).length;
    customerJson.wonDealsCount = customerJson.deals.filter(
      (d: any) => d.stage?.name === "Won"
    ).length;

    res.json(customerJson);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
