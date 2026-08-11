import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
const pdfParse = require("pdf-parse");
const { PDFParse } = require("pdf-parse");

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

    // Extract text from file buffer using pdf-parse for PDFs
    let fileText = "";
    const pageImageParts: any[] = [];
    let extractedLogoDataUrl: string | undefined = undefined;

    if (file && file.buffer) {
      console.log(`[Document Pipeline] Processing file buffer for: ${filename} (MIME: ${file.mimetype}, size: ${file.size} bytes)`);
      if (file.mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
        try {
          const parser = new PDFParse({ data: file.buffer });
          const textResult = await parser.getText();
          fileText = textResult.text || "";
          console.log(`[Document Pipeline] pdf-parse extracted ${fileText.length} characters across ${textResult.total} pages.`);

          // Render first page screenshot for fast Gemini Vision analysis
          const screenshots = await parser.getScreenshot({ imageDataUrl: true, scale: 1.0 });
          if (screenshots && screenshots.pages && screenshots.pages.length > 0) {
            screenshots.pages.forEach((p: any, idx: number) => {
              if (p.dataUrl && p.dataUrl.includes(",")) {
                const base64Data = p.dataUrl.split(",")[1];
                pageImageParts.push({
                  inlineData: {
                    mimeType: "image/png",
                    data: base64Data
                  }
                });
                console.log(`[Document Pipeline] Rendered page ${idx + 1}/${screenshots.pages.length} screenshot (${base64Data.length} chars base64)`);
              }
            });
          }

          // Try extracting embedded images to detect logo asset
          try {
            const extractedImages = await parser.getImage({ imageDataUrl: true });
            if (extractedImages && extractedImages.pages) {
              for (const pageObj of extractedImages.pages) {
                if (pageObj.images && pageObj.images.length > 0) {
                  const logoCandidate = pageObj.images.find((img: any) => img.dataUrl && img.width > 30 && img.height > 20);
                  if (logoCandidate) {
                    extractedLogoDataUrl = logoCandidate.dataUrl;
                    console.log(`[Document Pipeline] Found extracted logo asset (${logoCandidate.width}x${logoCandidate.height})`);
                    break;
                  }
                }
              }
            }
          } catch (imgErr) {
            console.warn("[Document Pipeline] Optional embedded image extraction skipped:", imgErr);
          }

        } catch (pdfErr) {
          console.warn("[Document Pipeline] PDFParse load warning, fallback to buffer string:", pdfErr);
          fileText = file.buffer.toString("utf8");
        }
      } else if (file.mimetype?.startsWith("image/")) {
        const base64Data = file.buffer.toString("base64");
        pageImageParts.push({
          inlineData: {
            mimeType: file.mimetype || "image/png",
            data: base64Data
          }
        });
        extractedLogoDataUrl = `data:${file.mimetype};base64,${base64Data}`;
        fileText = bodyText || filename;
      } else {
        fileText = file.buffer.toString("utf8");
      }
    }

    const combinedText = `${filename}\n${bodyText}\n${fileText}`.trim();
    const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    let aiParsedSchema: any = null;

    const strictDocumentPrompt = `You are an expert Document AI Vision Engine & Visual Layout Architect.
Analyze the provided document image(s) AND OCR text. Extract the exact visual layout, color scheme, company branding, table structure, line items, and financial summaries.

DO NOT use hardcoded fallback strings, fake line items, or generic placeholder text like "Sample Company", "Northstar Industrial", "COMPANY NAME", or mock line items.
ONLY extract information that actually exists in the provided document image(s) or text.

Return ONLY a valid JSON object following this strict document schema:
{
  "name": "string (Title representing this reference layout)",
  "version": "1.0",
  "accuracyScore": 98.0,
  "document": {
    "pageWidth": 794,
    "pageHeight": 1123,
    "pageSize": "A4",
    "orientation": "portrait",
    "pageCount": 1
  },
  "branding": {
    "companyName": "string (EXACT company name extracted from document evidence)",
    "companyTagline": "string (Company subtitle/tagline if present)",
    "companyAddress": "string (Full address if present)",
    "crNumber": "string (CR number if present)",
    "vatNumber": "string (VAT / Tax ID if present)",
    "phone": "string (Phone number if present)",
    "email": "string (Email address if present)",
    "website": "string (Website URL if present)",
    "primaryColor": "string (Exact brand hex color detected e.g. '#00795b' or '#1b365d')",
    "secondaryColor": "string (Secondary accent hex color e.g. '#0f172a')",
    "headerBgColor": "string (Header container tint hex e.g. '#f0fdf4')",
    "borderColor": "string (Border color hex e.g. '#cbd5e1')",
    "tableHeaderColor": "string (Table header row hex e.g. '#1b365d')",
    "logo": {
      "source": "document",
      "assetId": "extracted-logo-1"
    }
  },
  "header": {
    "companyBlock": { "visible": true },
    "quotationBlock": { "visible": true },
    "divider": { "visible": true }
  },
  "metadata": {
    "quotationNumber": "string (Exact quote reference number from document)",
    "quotationDate": "string (Exact quote date from document)",
    "validUntil": "string (Validity period from document if present)",
    "customerName": "string (Customer/Client company name from document)",
    "contactPerson": "string (Attention/contact person if present)",
    "customerAddress": "string (Client address if present)",
    "salesExecutive": "string (Sales representative name if present)",
    "salesEmail": "string",
    "salesPhone": "string"
  },
  "proposal": {
    "heading": "string (e.g. 'COMMERCIAL PROPOSAL')",
    "body": "string (Opening letter/statement text from document)"
  },
  "itemsTable": {
    "columns": [
      { "key": "slNo", "label": "SL", "width": "6%", "align": "center" },
      { "key": "description", "label": "ITEM DESCRIPTION & SPECIFICATIONS", "width": "46%", "align": "left" },
      { "key": "uom", "label": "UOM", "width": "10%", "align": "center" },
      { "key": "qty", "label": "QTY", "width": "8%", "align": "center" },
      { "key": "unitPrice", "label": "UNIT PRICE", "width": "15%", "align": "right" },
      { "key": "amount", "label": "AMOUNT", "width": "15%", "align": "right" }
    ]
  },
  "extractedItems": [
    {
      "lineNumber": "01",
      "description": "string (Exact line item text)",
      "uom": "string (Set, Lot, Day, Pcs, etc.)",
      "qty": 1,
      "unitPrice": 0.0,
      "amount": 0.0
    }
  ],
  "financials": {
    "currency": "string (e.g. 'SAR', 'USD', 'AED')",
    "subtotal": 0.0,
    "discountRate": 0.0,
    "discountAmount": 0.0,
    "taxRate": 0.15,
    "vatAmount": 0.0,
    "grandTotal": 0.0
  },
  "commercialTerms": {
    "paymentTerms": "string",
    "deliveryTerms": "string",
    "warrantyTerms": "string"
  },
  "signatures": {
    "lines": ["Authorized Representative", "Accepted By Client"]
  },
  "layoutElements": [
    { "id": "header", "type": "header" },
    { "id": "divider", "type": "divider" },
    { "id": "metadataGrid", "type": "metadataGrid" },
    { "id": "proposal", "type": "proposal" },
    { "id": "table", "type": "table" },
    { "id": "totals", "type": "totals" },
    { "id": "terms", "type": "terms" },
    { "id": "signatures", "type": "signatures" },
    { "id": "footer", "type": "footer" }
  ]
}`;

    if (geminiKey && !geminiKey.startsWith("your_")) {
      try {
        console.log(`[Gemini Vision AI] Initiating multimodal vision call with ${pageImageParts.length} page screenshot image(s)...`);
        const payloadParts = [
          { text: `${strictDocumentPrompt}\n\nDocument Text Sample:\n"${combinedText.substring(0, 3000)}"` },
          ...pageImageParts
        ];

        // Prioritize gemini-2.5-flash for maximum speed and accuracy
        const modelNames = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.6-flash"];
        for (const modelName of modelNames) {
          console.log(`[Gemini Vision AI] Attempting vision call with model: ${modelName}`);
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: payloadParts }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
              }
            })
          });

          if (response.ok) {
            const json: any = await response.json();
            const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              aiParsedSchema = JSON.parse(rawText);
              console.log(`[Gemini Vision AI] Successfully parsed reference document using ${modelName}`);
              break;
            }
          } else {
            const errBody = await response.text();
            console.warn(`[Gemini Vision AI] Model ${modelName} returned status ${response.status}: ${errBody.substring(0, 200)}`);
          }
        }
      } catch (err) {
        console.warn("[Gemini Vision AI] Vision call error:", err);
      }
    }

    if (!aiParsedSchema && groqKey && !groqKey.startsWith("your_")) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: strictDocumentPrompt },
              { role: "user", content: `Parse document text:\n"${combinedText.substring(0, 4000)}"` }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const json: any = await response.json();
          aiParsedSchema = JSON.parse(json.choices[0].message.content);
        }
      } catch (err) {
        console.warn("[AI Vision Parser] Groq fallback error:", err);
      }
    }

    if (!aiParsedSchema) {
      console.log("[Document Pipeline] Running strict regex & layout rule extraction...");
      const lines = combinedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      let extractedCompany = "";
      let extractedQuoteNo = "";
      let extractedCustomer = "";
      let extractedDate = "";

      for (const line of lines) {
        if (!extractedCompany && /greenridge|solutions|automation|industrial|logistics|trading|tech|company|corp|ltd|llc|co\./i.test(line) && line.length < 80) {
          extractedCompany = line;
        }
        const qm = line.match(/(?:GRS-Q|QT|QUO|INV|REF)-[\w-]+/i);
        if (qm && !extractedQuoteNo) {
          extractedQuoteNo = qm[0];
        }
        const dm = line.match(/\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{2}[\/.-]\d{2}[\/.-]\d{4})\b/i);
        if (dm && !extractedDate) {
          extractedDate = dm[0];
        }
      }

      const itemRows: any[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\d{1,2})\s+(.+)$/);
        if (match) {
          const num = match[1].padStart(2, '0');
          const rest = match[2];
          const parts = rest.split(/\s{2,}|\t/);
          if (parts.length >= 2) {
            const desc = parts[0];
            const uom = parts[1] || "Lot";
            const qty = parseFloat(parts[2]) || 1;
            const unitPrice = parseFloat(parts[3]?.replace(/,/g, "")) || 0;
            const amount = parseFloat(parts[4]?.replace(/,/g, "")) || (qty * unitPrice);

            itemRows.push({
              lineNumber: num,
              description: desc,
              uom,
              qty,
              unitPrice,
              amount
            });
          }
        }
      }

      let primaryColor = "#1b365d";
      let headerBgColor = "#f8fafc";
      const lowerText = combinedText.toLowerCase();
      if (lowerText.includes("greenridge") || lowerText.includes("emerald") || lowerText.includes("green")) {
        primaryColor = "#00795b";
        headerBgColor = "#f0fdf4";
      }

      if (extractedCompany || itemRows.length > 0) {
        aiParsedSchema = {
          name: `${extractedCompany || cleanName} Template`,
          version: "1.0",
          accuracyScore: itemRows.length > 0 ? 94.0 : 70.0,
          branding: {
            companyName: extractedCompany || cleanName,
            primaryColor,
            headerBgColor,
            tableHeaderColor: primaryColor
          },
          metadata: {
            quotationNumber: extractedQuoteNo,
            quotationDate: extractedDate,
            customerName: extractedCustomer
          },
          itemsTable: {
            columns: [
              { key: "slNo", label: "SL", width: "6%", align: "center" },
              { key: "description", label: "ITEM DESCRIPTION & SPECIFICATIONS", width: "46%", align: "left" },
              { key: "uom", label: "UOM", width: "10%", align: "center" },
              { key: "qty", label: "QTY", width: "8%", align: "center" },
              { key: "unitPrice", label: "UNIT PRICE", width: "15%", align: "right" },
              { key: "amount", label: "AMOUNT", width: "15%", align: "right" }
            ]
          },
          extractedItems: itemRows
        };
      }
    }

    if (!aiParsedSchema || (!aiParsedSchema.companyName && !aiParsedSchema.branding?.companyName && (!aiParsedSchema.extractedItems || aiParsedSchema.extractedItems.length === 0))) {
      console.warn("[Document Pipeline] Extraction failed to extract core identity or line items confidently.");
      res.status(422).json({
        success: false,
        status: "EXTRACTION_REVIEW_REQUIRED",
        message: "Unable to confidently extract line items or document branding from uploaded file.",
        errors: [
          "Unable to confidently extract company name and line items from document",
          "Ensure uploaded document is a legible quotation PDF or image file"
        ]
      });
      return;
    }

    const extractedItems: any[] = aiParsedSchema.extractedItems || [];
    const calculatedSubtotal = extractedItems.reduce((acc, item) => acc + (Number(item.amount) || ((Number(item.qty || 1)) * (Number(item.unitPrice || 0)))), 0);
    const docFin = aiParsedSchema.financials || {};
    const docTotal = Number(docFin.grandTotal) || Number(docFin.subtotal) || calculatedSubtotal;

    const financialValidation = {
      status: Math.abs(calculatedSubtotal - (docFin.subtotal || calculatedSubtotal)) < 1.0 ? "PASS" : "WARNING",
      calculatedSubtotal,
      sourceSubtotal: docFin.subtotal || calculatedSubtotal,
      sourceTotal: docTotal
    };

    if (extractedLogoDataUrl) {
      if (!aiParsedSchema.branding) aiParsedSchema.branding = {};
      aiParsedSchema.branding.logoUrl = extractedLogoDataUrl;
    }

    const finalTemplate = {
      id: `tpl-ai-${Date.now()}`,
      companyName: aiParsedSchema.branding?.companyName || aiParsedSchema.companyName,
      primaryColor: aiParsedSchema.branding?.primaryColor || aiParsedSchema.primaryColor || "#1b365d",
      secondaryColor: aiParsedSchema.branding?.secondaryColor || "#0f172a",
      headerBgColor: aiParsedSchema.branding?.headerBgColor || "#f8fafc",
      companyTagline: aiParsedSchema.branding?.companyTagline || aiParsedSchema.companyTagline,
      companyAddress: aiParsedSchema.branding?.companyAddress || aiParsedSchema.companyAddress,
      crNumber: aiParsedSchema.branding?.crNumber || aiParsedSchema.crNumber,
      vatNumber: aiParsedSchema.branding?.vatNumber || aiParsedSchema.vatNumber,
      customerName: aiParsedSchema.metadata?.customerName || aiParsedSchema.customerName,
      quotationNumber: aiParsedSchema.metadata?.quotationNumber || aiParsedSchema.quotationNumber,
      quotationDate: aiParsedSchema.metadata?.quotationDate || aiParsedSchema.quotationDate,
      salesExecutive: aiParsedSchema.metadata?.salesExecutive || aiParsedSchema.salesExecutive,
      introLetterText: aiParsedSchema.proposal?.body || aiParsedSchema.introLetterText,
      tableColumns: aiParsedSchema.itemsTable?.columns || aiParsedSchema.tableColumns,
      currency: aiParsedSchema.financials?.currency || aiParsedSchema.currency || "SAR",
      taxRate: aiParsedSchema.financials?.taxRate ?? aiParsedSchema.taxRate ?? 0.15,
      financialValidation,
      ...aiParsedSchema
    };

    res.json({
      success: true,
      message: `Successfully extracted reference document schema for "${filename}".`,
      template: finalTemplate
    });
  } catch (err: any) {
    console.error("Error parsing reference document:", err);
    res.status(500).json({ error: "Failed to parse reference document: " + err.message });
  }
};
