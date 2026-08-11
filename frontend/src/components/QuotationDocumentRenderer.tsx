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
    companyName: leadData?.companyName || "Company Name",
    primaryColor: "#1b365d",
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

  // Dynamic Financial Calculations from passed items
  const subtotal = items.reduce((acc, item) => acc + (Number(item.total) || (Number(item.quantity || item.qty || 1) * Number(item.unitPrice || 0)) || 0), 0);
  const discountRate = activeTpl.discountRate || (activeTpl.discount ? activeTpl.discount / 100 : 0);
  const discountAmount = subtotal * discountRate;
  const taxableAmount = subtotal - discountAmount;
  const vatAmount = taxableAmount * (activeTpl.taxRate || 0.15);
  const grandTotal = taxableAmount + vatAmount;
  const currency = activeTpl.currency || "SAR";

  const columns = activeTpl.tableColumns || [
    { key: "item", label: "Item", width: "8%", align: "center" },
    { key: "description", label: "Description", width: "50%", align: "left" },
    { key: "qty", label: "Qty", width: "9%", align: "center" },
    { key: "unitPrice", label: "Unit Price", width: "17%", align: "right" },
    { key: "amount", label: "Amount", width: "16%", align: "right" }
  ];

  const compName = activeTpl.companyName || activeTpl.name || "COMPANY NAME";
  const primaryColor = activeTpl.primaryColor || "#1b365d";

  return (
    <div className="quotation-document-container">
      
      {/* 1. Header Bar: Logo/Name left, QUOTATION title right */}
      <div className="doc-header-bar">
        <div>
          <h1 className="doc-company-title" style={{ color: primaryColor }}>
            {compName}
          </h1>
          {activeTpl.companyTagline && (
            <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0 0", fontWeight: 600 }}>{activeTpl.companyTagline}</p>
          )}
          {activeTpl.companyAddress && (
            <p style={{ fontSize: "9.5px", color: "#64748b", margin: "1px 0 0 0" }}>{activeTpl.companyAddress}</p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 className="doc-quote-title" style={{ color: primaryColor }}>
            QUOTATION
          </h2>
          <p className="doc-quote-number" style={{ color: primaryColor }}>
            #{quotationNumber || activeTpl.quotationNumber || `QT-${new Date().getFullYear()}-001`}
          </p>
        </div>
      </div>

      {/* Thin Horizontal Divider Line */}
      <div className="doc-divider-line" style={{ backgroundColor: primaryColor }}></div>

      {/* 2. Compact 3-Column Metadata Grid */}
      <div className="doc-meta-grid">
        <div className="doc-meta-col">
          <span className="doc-meta-label">Prepared for</span>
          <div className="doc-meta-value">{leadData?.companyName || leadData?.contactName || activeTpl.customerName || "[Client Company Name]"}</div>
          {leadData?.contactName && <div className="doc-meta-sub">Attn: {leadData.contactName}</div>}
          {leadData?.address && <div className="doc-meta-sub">{leadData.address}</div>}
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">Quote Date</span>
          <div className="doc-meta-value">{quotationDate || activeTpl.quotationDate || new Date().toLocaleDateString('en-GB')}</div>
          <div style={{ marginTop: "8px" }}>
            <span className="doc-meta-label">Valid Until</span>
            <div className="doc-meta-value">{activeTpl.validUntil || "30 Days from issue"}</div>
          </div>
        </div>

        <div className="doc-meta-col">
          <span className="doc-meta-label">Sales Executive</span>
          <div className="doc-meta-value">{salesExecutive || activeTpl.salesExecutive || "[Sales Executive]"}</div>
          {activeTpl.salesEmail && <div className="doc-meta-sub">{activeTpl.salesEmail}</div>}
          {activeTpl.salesPhone && <div className="doc-meta-sub">{activeTpl.salesPhone}</div>}
        </div>
      </div>

      {/* 3. Proposal Heading & Opening Statement */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: primaryColor }}>
          Commercial Proposal
        </h3>
        <p className="doc-proposal-text">
          {activeTpl.introLetterText || "With reference to your recent inquiry, we are pleased to submit our commercial proposal under the itemized pricing and terms outlined below:"}
        </p>
      </div>

      {/* 4. Strict Dynamic Line Items Table */}
      <table className="doc-items-table">
        <thead>
          <tr style={{ backgroundColor: primaryColor }}>
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
                No line items available. Select or add line items to display here.
              </td>
            </tr>
          ) : (
            items.map((item: any, idx: number) => (
              <tr key={idx}>
                {columns.map((col: any, colIdx: number) => {
                  const key = col.key;
                  let val = item[key];
                  if (key === "item" || key === "slNo" || key === "lineNumber") val = item.lineNumber || String(idx + 1).padStart(2, '0');
                  if (key === "description") val = item.description || item.name || "Line Item Description";
                  if (key === "uom") val = item.uom || item.unit || "Lot";
                  if (key === "qty" || key === "quantity") val = item.qty || item.quantity || 1;
                  if (key === "unitPrice") val = `${currency} ${Number(item.unitPrice || 0).toLocaleString('en-US')}`;
                  if (key === "amount" || key === "price" || key === "total") val = `${currency} ${Number(item.amount || item.total || ((item.qty || item.quantity || 1) * item.unitPrice) || 0).toLocaleString('en-US')}`;

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

      {/* 5. Dynamic Financial Summary Grid (Right-Aligned) */}
      <div className="doc-financials-wrapper">
        <div className="doc-financials-box">
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>{currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>Volume Discount ({((discountRate > 0 ? discountRate : 0.05) * 100).toFixed(0)}%)</span>
            <span style={{ fontWeight: 700 }}>- {currency} {(discountAmount > 0 ? discountAmount : (subtotal * 0.05)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="doc-financial-row">
            <span style={{ fontWeight: 600 }}>VAT ({((activeTpl.taxRate || 0.15) * 100).toFixed(0)}%)</span>
            <span style={{ fontWeight: 700 }}>{currency} {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="doc-financial-row total-row" style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` }}>
            <span style={{ fontWeight: 800 }}>TOTAL</span>
            <span style={{ fontWeight: 800, color: primaryColor }}>{currency} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* 6. Commercial Terms Section */}
      <div className="doc-proposal-section">
        <h3 className="doc-section-heading" style={{ color: primaryColor }}>
          Commercial Terms
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: "1px solid #cbd5e1" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ width: "150px", padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Payment Terms</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>{activeTpl.paymentTerms || "30 Days Net from date of tax invoice submission."}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Delivery</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>{activeTpl.deliveryTerms || "Mobilization within agreed schedule after PO confirmation."}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Warranty</td>
              <td style={{ padding: "8px 12px", color: "#334155" }}>{activeTpl.warrantyTerms || "12 months standard warranty against manufacturing defects."}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 7. Footer & Signatures */}
      <div className="doc-footer-signatures">
        <div>
          <p style={{ fontWeight: 700, color: "#1e293b", margin: 0 }}>{compName}</p>
          {(activeTpl.crNumber || activeTpl.vatNumber) && (
            <p style={{ margin: "2px 0 0 0" }}>
              {activeTpl.crNumber && `CR: ${activeTpl.crNumber}`} {activeTpl.vatNumber && `| VAT: ${activeTpl.vatNumber}`}
            </p>
          )}
        </div>
        <div className="doc-signature-box">
          <div className="doc-signature-line"></div>
          <span>Authorized Signature</span>
        </div>
      </div>

    </div>
  );
}
