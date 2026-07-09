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
    const quotes = await sequelize.models.Quote.findAll();
    
    let csv = "Quote Number,Version,Status,Total Amount,Expiration Date\n";
    quotes.forEach((q: any) => {
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
    const pos = await sequelize.models.PurchaseOrder.findAll();
    
    let csv = "PO Number,Amount,Status,Generated Date\n";
    pos.forEach((p: any) => {
      csv += `"${p.poNumber}","${Number(p.amount).toFixed(2)}","${p.status}","${new Date(p.createdAt).toLocaleDateString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=purchase_orders_export.csv");
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
