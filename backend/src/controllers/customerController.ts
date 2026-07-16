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

    // Fetch associated deals
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
      } else {
        customerJson.invoices = [];
      }
    } else {
      customerJson.quotes = [];
      customerJson.invoices = [];
    }

    res.json(customerJson);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
