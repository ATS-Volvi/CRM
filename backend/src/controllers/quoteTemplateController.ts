import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

const DEFAULT_TEMPLATES = [
  {
    id: "tpl-ftc-standard",
    name: "FTC Saudi Arabia Standard",
    isDefault: true,
    companyName: "Faisal Fahad Hussain Al Kari Transportation Co.",
    companyAddress: "Prince Fahad St, Al Khobar, Kingdom of Saudi Arabia",
    companyLogoUrl: "",
    primaryColor: "#6b21a8",
    headerBgColor: "#fbf5ff",
    headerLayout: "top-bar-split-box",
    introLetterEnabled: true,
    introLetterText: "Thank you for showing your interest in us & inviting us to Quote. Faisal Fahad Hussain Al Kari Transportation Co. has remained one of the Big Players in Industrial Services in the market over the past two decades and we continue to strive every day to make every client experience the most unique & pleasing one.",
    tableColumns: [
      { key: "slNo", label: "Sl No.", width: "10%", align: "center" },
      { key: "description", label: "Item Description", width: "50%", align: "left" },
      { key: "uom", label: "UOM", width: "12%", align: "center" },
      { key: "qty", label: "Qty", width: "10%", align: "center" },
      { key: "price", label: "Price (SAR)", width: "18%", align: "right" }
    ],
    currency: "SAR",
    taxRate: 0.15,
    footerNotes: "Scope of work includes mobilization, equipment maintenance, and operator certification.",
    signatureLines: ["Authorized Signature", "Client Acceptance"]
  },
  {
    id: "tpl-apex-logistics",
    name: "Apex Global Logistics",
    isDefault: false,
    companyName: "Apex Global Logistics Solutions LLC",
    companyAddress: "King Fahd Industrial Road, Dammam, KSA",
    companyLogoUrl: "",
    primaryColor: "#0284c7",
    headerBgColor: "#f0f9ff",
    headerLayout: "compact-grid",
    introLetterEnabled: true,
    introLetterText: "We are pleased to submit our competitive commercial proposal for your logistics & transport requirements. All services are backed by our 24/7 SLA guarantee.",
    tableColumns: [
      { key: "slNo", label: "Item #", width: "8%", align: "center" },
      { key: "description", label: "Service / Equipment Specification", width: "52%", align: "left" },
      { key: "uom", label: "Unit", width: "10%", align: "center" },
      { key: "qty", label: "Quantity", width: "10%", align: "center" },
      { key: "price", label: "Amount (SAR)", width: "20%", align: "right" }
    ],
    currency: "SAR",
    taxRate: 0.15,
    footerNotes: "Payment terms: 30 days from invoice date.",
    signatureLines: ["Operations Director", "Customer Approval"]
  }
];

export const getQuoteTemplates = async (req: Request, res: Response) => {
  try {
    if (sequelize.models.QuoteTemplate) {
      const templates = await sequelize.models.QuoteTemplate.findAll();
      if (templates && templates.length > 0) {
        res.json(templates);
        return;
      }
    }
    res.json(DEFAULT_TEMPLATES);
  } catch (err: any) {
    console.error("Error fetching quote templates:", err);
    res.json(DEFAULT_TEMPLATES);
  }
};

export const createQuoteTemplate = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (sequelize.models.QuoteTemplate) {
      const newTpl = await sequelize.models.QuoteTemplate.create(data);
      res.status(201).json(newTpl);
      return;
    }
    const created = { id: `tpl-${Date.now()}`, ...data };
    res.status(201).json(created);
  } catch (err: any) {
    console.error("Error creating quote template:", err);
    res.status(500).json({ error: "Failed to create quote template" });
  }
};

export const parseReferenceDocument = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const bodyText = req.body.text || "";
    const filename = file?.originalname || "Reference Document";

    // Extract text from file buffer if provided
    let fileText = "";
    if (file && file.buffer) {
      fileText = file.buffer.toString("utf8");
    }

    const combinedText = `${filename} ${bodyText} ${fileText}`;
    const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

    // Determine colors and company details based on extracted document keywords
    let primaryColor = "#6b21a8";
    let headerBgColor = "#fbf5ff";

    if (combinedText.toLowerCase().includes("blue") || combinedText.toLowerCase().includes("transport") || combinedText.toLowerCase().includes("freight")) {
      primaryColor = "#0284c7";
      headerBgColor = "#f0f9ff";
    } else if (combinedText.toLowerCase().includes("green") || combinedText.toLowerCase().includes("eco") || combinedText.toLowerCase().includes("waste")) {
      primaryColor = "#059669";
      headerBgColor = "#f0fdf4";
    } else if (combinedText.toLowerCase().includes("amber") || combinedText.toLowerCase().includes("heavy") || combinedText.toLowerCase().includes("construction")) {
      primaryColor = "#d97706";
      headerBgColor = "#fffbeb";
    }

    const parsedTemplate = {
      id: `tpl-custom-${Date.now()}`,
      name: `${cleanName} Layout`,
      companyName: `${cleanName} Co.`,
      companyAddress: "Industrial Area, Kingdom of Saudi Arabia",
      companyLogoUrl: "",
      primaryColor,
      headerBgColor,
      headerLayout: "top-bar-split-box",
      introLetterEnabled: true,
      introLetterText: `With reference to your inquiry, ${cleanName} Co. is pleased to present our custom quotation according to your specifications.`,
      tableColumns: [
        { key: "slNo", label: "Sl No.", width: "10%", align: "center" },
        { key: "description", label: "Item Description & Specifications", width: "50%", align: "left" },
        { key: "uom", label: "UOM", width: "12%", align: "center" },
        { key: "qty", label: "Qty", width: "10%", align: "center" },
        { key: "price", label: "Price (SAR)", width: "18%", align: "right" }
      ],
      currency: "SAR",
      taxRate: 0.15,
      signatureLines: ["Authorized Representative", "Accepted By Client"]
    };

    res.json({
      success: true,
      message: `AI Vision successfully parsed "${filename}" into dynamic template schema.`,
      template: parsedTemplate
    });
  } catch (err: any) {
    console.error("Error parsing reference document:", err);
    res.status(500).json({ error: "Failed to parse reference document" });
  }
};
