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
    companyName: "Northstar Industrial Solutions Co.",
    companyAddress: "King Fahd Industrial Highway, Dammam, KSA",
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
          <h1 style={{ color: activeTpl.primaryColor || "#1e3a8a", fontSize: "18px", fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
            {activeTpl.companyName}
          </h1>
          <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0 0" }}>{activeTpl.companyAddress}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: activeTpl.primaryColor || "#1e3a8a", margin: 0, tracking: "0.05em" }}>
            QUOTATION
          </h2>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#334155", margin: "2px 0 0 0" }}>
            {quotationNumber || `QT-${new Date().getFullYear()}-0881`}
          </p>
        </div>
      </div>

      {/* Thin Horizontal Blue Divider */}
      <div className="doc-divider-line" style={{ backgroundColor: activeTpl.primaryColor || "#1e3a8a" }}></div>

      {/* 2. Compact 3-Column Metadata Grid */}
      <div className="doc-meta-grid">
        <div className="doc-meta-col">
          <span className="doc-meta-label">PREPARED FOR</span>
          <div className="doc-meta-value">{leadData?.companyName || leadData?.contactName || "Aramco Operations"}</div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
            {leadData?.address || "Abqaiq Industrial Zone, Eastern Province"}
          </div>
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">QUOTE DATE & VALIDITY</span>
          <div className="doc-meta-value">Date: {quotationDate || new Date().toLocaleDateString('en-GB')}</div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>Valid Until: 30 Days</div>
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">SALES EXECUTIVE</span>
          <div className="doc-meta-value">{salesExecutive || "Sophia Martinez"}</div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>sophia@northstar.sa</div>
        </div>
      </div>

      {/* 3. Proposal Heading & Opening Paragraph */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: activeTpl.primaryColor || "#1e3a8a" }}>
          Commercial Proposal
        </h3>
        <p className="doc-proposal-text">
          With reference to your recent inquiry regarding equipment deployment and industrial supply, we are pleased to submit our commercial proposal under the terms and itemized pricing outlined below:
        </p>
      </div>

      {/* 4. Strict Line Items Table */}
      <table className="doc-items-table">
        <thead>
          <tr style={{ backgroundColor: activeTpl.primaryColor || "#1e3a8a" }}>
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
              <td colSpan={columns.length} style={{ textAlign: "center", padding: "16px", color: "#94a3b8", italic: "true" }}>
                No line items added to this quotation yet.
              </td>
            </tr>
          ) : (
            items.map((item: any, idx: number) => (
              <tr key={idx}>
                {columns.map((col: any, colIdx: number) => {
                  const key = col.key;
                  let val = item[key];
                  if (key === "item" || key === "slNo") val = idx + 1;
                  if (key === "description") val = item.description || item.name || "Industrial Line Item";
                  if (key === "unitPrice") val = formatCurrency(item.unitPrice || 0);
                  if (key === "amount" || key === "price" || key === "total") val = formatCurrency(item.total || (item.quantity * item.unitPrice) || 0);

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
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="doc-financial-row">
            <span>Volume Discount:</span>
            <span>{formatCurrency(discount)}</span>
          </div>
          <div className="doc-financial-row">
            <span>VAT ({((activeTpl.taxRate || 0.15) * 100).toFixed(0)}%):</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="doc-financial-row total-row" style={{ borderTopColor: activeTpl.primaryColor || "#1e3a8a" }}>
            <span>TOTAL ({activeTpl.currency || "SAR"}):</span>
            <span style={{ color: activeTpl.primaryColor || "#1e3a8a" }}>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* 6. Commercial Terms Section */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: activeTpl.primaryColor || "#1e3a8a" }}>
          Commercial Terms
        </h3>
        <div className="doc-terms-grid">
          <div className="doc-term-item">
            <span className="doc-term-label">Payment Terms:</span>
            <span className="doc-term-value">30 Days Net from date of tax invoice submission.</span>
          </div>
          <div className="doc-term-item">
            <span className="doc-term-label">Delivery Schedule:</span>
            <span className="doc-term-value">Mobilization within 48 hours of Purchase Order confirmation.</span>
          </div>
          <div className="doc-term-item">
            <span className="doc-term-label">Warranty / Service:</span>
            <span className="doc-term-value">24/7 On-site maintenance support included.</span>
          </div>
        </div>
      </div>

      {/* 7. Footer & Signatures */}
      <div className="doc-footer-signatures">
        <div>
          <p style={{ fontWeight: 700, color: "#1e293b", margin: 0 }}>{activeTpl.companyName}</p>
          <p style={{ margin: "2px 0 0 0" }}>Commercial Registration: KSA-3029192 | Tax ID: 3102919200003</p>
        </div>
        <div className="doc-signature-box">
          <div className="doc-signature-line"></div>
          <span>Authorized Signature</span>
        </div>
      </div>

    </div>
  );
}
