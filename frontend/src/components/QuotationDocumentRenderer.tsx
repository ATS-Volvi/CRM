import React from "react";
import "../styles/quotation-document.css";
import { formatCurrency } from "../utils/currency";

interface QuotationDocumentProps {
  template?: any;
  leadData?: any;
  items?: any[];
  quotationNumber?: string;
  quotationDate?: string;
  salesExecutive?: string;
}

export default function QuotationDocumentRenderer({
  template,
  leadData,
  items = [],
  quotationNumber,
  quotationDate,
  salesExecutive
}: QuotationDocumentProps) {
  const activeTpl = template || {
    companyName: "Faisal Fahad Hussain Al Kari Transportation Co.",
    companyAddress: "Prince Fahad St, Al Khobar, Kingdom of Saudi Arabia",
    crNumber: "CR-3029192",
    vatNumber: "VAT-3102919200003",
    primaryColor: "#1e3a8a",
    tableColumns: [
      { key: "item", label: "Item", width: "8%", align: "center" },
      { key: "description", label: "Description", width: "50%", align: "left" },
      { key: "qty", label: "Qty", width: "9%", align: "center" },
      { key: "unitPrice", label: "Unit Price", width: "17%", align: "right" },
      { key: "amount", label: "Amount", width: "16%", align: "right" }
    ],
    currency: "SAR",
    taxRate: 0.15
  };

  const subtotal = items.reduce((acc, item) => acc + (item.total || (item.quantity * item.unitPrice) || 0), 0);
  const discount = 0;
  const vatAmount = subtotal * (activeTpl.taxRate || 0.15);
  const grandTotal = subtotal - discount + vatAmount;

  const columns = activeTpl.tableColumns || [
    { key: "item", label: "Item", width: "8%", align: "center" },
    { key: "description", label: "Description", width: "50%", align: "left" },
    { key: "qty", label: "Qty", width: "9%", align: "center" },
    { key: "unitPrice", label: "Unit Price", width: "17%", align: "right" },
    { key: "amount", label: "Amount", width: "16%", align: "right" }
  ];

  return (
    <div className="quotation-document-container">
      
      {/* 1. Header Bar: Logo/Name left, QUOTATION title right */}
      <div className="doc-header-bar">
        <div>
          <h1 className="doc-company-title" style={{ color: activeTpl.primaryColor || "#1b365d" }}>
            {activeTpl.companyName || "NORTHSTAR INDUSTRIAL SOLUTIONS"}
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 className="doc-quote-title" style={{ color: activeTpl.primaryColor || "#1b365d" }}>
            QUOTATION
          </h2>
          <p className="doc-quote-number" style={{ color: activeTpl.primaryColor || "#1b365d" }}>
            #{quotationNumber || "NS-QUO-2026-0847"}
          </p>
        </div>
      </div>

      {/* Thin Horizontal Blue Divider Line */}
      <div className="doc-divider-line" style={{ backgroundColor: activeTpl.primaryColor || "#1b365d" }}></div>

      {/* 2. Compact 3-Column Metadata Grid */}
      <div className="doc-meta-grid">
        <div className="doc-meta-col">
          <span className="doc-meta-label">Prepared for</span>
          <div className="doc-meta-value">{leadData?.companyName || leadData?.contactName || "Apex Manufacturing Pvt. Ltd."}</div>
          <div className="doc-meta-sub">Attn: {leadData?.contactName || "Rahul Sharma"}</div>
          <div className="doc-meta-sub">{leadData?.address || "Mumbai, Maharashtra, India"}</div>
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">Quote Date</span>
          <div className="doc-meta-value">{quotationDate || "10 Aug 2026"}</div>
          <div style={{ marginTop: "8px" }}>
            <span className="doc-meta-label">Valid Until</span>
            <div className="doc-meta-value">09 Sep 2026</div>
          </div>
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">Sales Executive</span>
          <div className="doc-meta-value">{salesExecutive || "Sophia Martinez"}</div>
          <div className="doc-meta-sub">sophia@northstar.example</div>
          <div className="doc-meta-sub">+91 98765 43210</div>
        </div>
      </div>

      {/* 3. Proposal Heading & Opening Statement */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: activeTpl.primaryColor || "#1b365d" }}>
          Commercial Proposal
        </h3>
        <p className="doc-proposal-text">
          {activeTpl.introLetterText || "Supply, installation and commissioning of industrial automation equipment and related services."}
        </p>
      </div>

      {/* 4. Strict Line Items Table */}
      <table className="doc-items-table">
        <thead>
          <tr style={{ backgroundColor: activeTpl.primaryColor || "#1b365d" }}>
            {columns.map((col: any, idx: number) => (
              <th key={idx} style={{ width: col.width, textAlign: col.align || "left" }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: "16px", color: "#94a3b8", fontStyle: "italic" }}>
                No line items added to this quotation yet.
              </td>
            </tr>
          ) : (
            items.map((item: any, idx: number) => (
              <tr key={idx}>
                {columns.map((col: any, colIdx: number) => {
                  const key = col.key;
                  let val = item[key];
                  if (key === "item" || key === "slNo") val = String(idx + 1).padStart(2, '0');
                  if (key === "description") val = item.description || item.name || "Industrial Line Item";
                  if (key === "unitPrice") val = `SAR ${Number(item.unitPrice || 0).toLocaleString('en-US')}`;
                  if (key === "amount" || key === "price" || key === "total") val = `SAR ${Number(item.total || (item.quantity * item.unitPrice) || 0).toLocaleString('en-US')}`;

                  return (
                    <td key={colIdx} style={{ textAlign: col.align || "left" }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 5. Financial Summary Grid (Right-Aligned) */}
      <div className="doc-financials-wrapper">
        <div className="doc-financials-box">
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>SAR 119,500</span>
          </div>
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>Volume Discount (5%)</span>
            <span style={{ fontWeight: 700 }}>- SAR 5,975</span>
          </div>
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>VAT (15%)</span>
            <span style={{ fontWeight: 700 }}>SAR 17,029</span>
          </div>
          <div className="doc-financial-row total-row" style={{ backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" }}>
            <span style={{ fontWeight: 800 }}>TOTAL</span>
            <span style={{ fontWeight: 800, color: "#1b365d" }}>SAR 130,554</span>
          </div>
        </div>
      </div>

      {/* 6. Commercial Terms Section */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: activeTpl.primaryColor || "#1b365d" }}>
          Commercial Terms
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: "1px solid #cbd5e1" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ width: "150px", padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Payment Terms</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>50% advance, 40% on delivery, 10% after commissioning.</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Delivery</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>6-8 weeks from receipt of advance payment and approved drawings.</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Warranty</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>12 months from commissioning against manufacturing defects.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 7. Footer & Signatures */}
      <div className="doc-footer-signatures">
        <div>
          <p style={{ fontWeight: 700, color: "#1e293b", margin: 0 }}>{activeTpl.companyName}</p>
          <p style={{ margin: "2px 0 0 0" }}>
            Commercial Registration: {activeTpl.crNumber || "CR-3029192"} | Tax Registration (VAT): {activeTpl.vatNumber || "VAT-3102919200003"}
          </p>
        </div>
        <div className="doc-signature-box">
          <div className="doc-signature-line"></div>
          <span>Authorized Signature</span>
        </div>
      </div>

    </div>
  );
}
