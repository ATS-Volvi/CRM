import React from "react";
import "../styles/quotation-document.css";

interface QuotationDocumentProps {
  template?: any;
  leadData?: any;
  items?: any[];
  quotationNumber?: string;
  quotationDate?: string;
  salesExecutive?: string;
  reviewRequired?: boolean;
  errors?: string[];
}

export default function QuotationDocumentRenderer({
  template,
  leadData,
  items = [],
  quotationNumber,
  quotationDate,
  salesExecutive,
  reviewRequired = false,
  errors = []
}: QuotationDocumentProps) {
  const activeTpl = template || {};

  // Extract Branding & Layout Variables
  const branding = activeTpl.branding || {};
  const metadata = activeTpl.metadata || {};
  const proposal = activeTpl.proposal || {};
  const financials = activeTpl.financials || {};
  const commercialTerms = activeTpl.commercialTerms || {};
  const signatures = activeTpl.signatures || {};

  const primaryColor = branding.primaryColor || activeTpl.primaryColor || "#00795b";
  const secondaryColor = branding.secondaryColor || activeTpl.secondaryColor || "#0f172a";
  const headerBgColor = branding.headerBgColor || activeTpl.headerBgColor || "#f0fdf4";
  const tableHeaderColor = branding.tableHeaderColor || activeTpl.tableHeaderColor || primaryColor;
  const borderColor = branding.borderColor || activeTpl.borderColor || "#cbd5e1";
  const logoUrl = branding.logoUrl || activeTpl.companyLogoUrl || activeTpl.logoUrl;

  const compName = branding.companyName || activeTpl.companyName || activeTpl.name;

  // Review Required guard: if company name or items are missing and review is explicitly flagged
  const isReviewMode = reviewRequired || activeTpl.status === "EXTRACTION_REVIEW_REQUIRED" || (!compName && items.length === 0);

  // Dynamic Financials Computation (Explicit financial data without generic 5% / 15% assumptions)
  const displayItems = items.length > 0 ? items : (activeTpl.extractedItems || []);
  const subtotal = displayItems.reduce((acc: number, item: any) => {
    const qty = Number(item.qty || item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const amount = item.amount !== undefined ? Number(item.amount) : (qty * unitPrice);
    return acc + (isNaN(amount) ? 0 : amount);
  }, 0);

  const discountRate = financials.discountRate !== undefined ? Number(financials.discountRate) : (activeTpl.discountRate || 0);
  const discountAmount = financials.discountAmount !== undefined ? Number(financials.discountAmount) : (subtotal * discountRate);
  const taxableAmount = subtotal - discountAmount;
  const taxRate = financials.taxRate !== undefined ? Number(financials.taxRate) : (activeTpl.taxRate !== undefined ? Number(activeTpl.taxRate) : 0.15);
  const vatAmount = financials.vatAmount !== undefined ? Number(financials.vatAmount) : (taxableAmount * taxRate);
  const grandTotal = financials.grandTotal !== undefined ? Number(financials.grandTotal) : (taxableAmount + vatAmount);
  const currency = financials.currency || activeTpl.currency || "SAR";

  // Columns specification
  const columns = activeTpl.itemsTable?.columns || activeTpl.tableColumns || [
    { key: "slNo", label: "SL", width: "6%", align: "center" },
    { key: "description", label: "ITEM DESCRIPTION & SPECIFICATIONS", width: "46%", align: "left" },
    { key: "uom", label: "UOM", width: "10%", align: "center" },
    { key: "qty", label: "QTY", width: "8%", align: "center" },
    { key: "unitPrice", label: "UNIT PRICE", width: "15%", align: "right" },
    { key: "amount", label: "AMOUNT", width: "15%", align: "right" }
  ];

  // Schema-Driven Layout Elements Iteration
  const layoutElements = activeTpl.layoutElements || [
    { id: "header", type: "header" },
    { id: "divider", type: "divider" },
    { id: "metadataGrid", type: "metadataGrid" },
    { id: "proposal", type: "proposal" },
    { id: "table", type: "table" },
    { id: "totals", type: "totals" },
    { id: "terms", type: "terms" },
    { id: "signatures", type: "signatures" },
    { id: "footer", type: "footer" }
  ];

  const cssStyleVars = {
    "--primary-color": primaryColor,
    "--secondary-color": secondaryColor,
    "--header-bg-color": headerBgColor,
    "--table-header-color": tableHeaderColor,
    "--border-color": borderColor,
    "--text-color": "#0f172a"
  } as React.CSSProperties;

  const renderElement = (element: any, idx: number) => {
    switch (element.type || element.id) {
      case "header":
        return (
          <div key={idx} className="doc-header-bar">
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="doc-logo-img" />
              ) : (
                compName && <h1 className="doc-company-title">{compName}</h1>
              )}
              {(branding.companyTagline || activeTpl.companyTagline) && (
                <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0 0", fontWeight: 600 }}>
                  {branding.companyTagline || activeTpl.companyTagline}
                </p>
              )}
              {(branding.companyAddress || activeTpl.companyAddress) && (
                <p style={{ fontSize: "9.5px", color: "#64748b", margin: "1px 0 0 0" }}>
                  {branding.companyAddress || activeTpl.companyAddress}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 className="doc-quote-title">QUOTATION</h2>
              <p className="doc-quote-number">
                #{quotationNumber || metadata.quotationNumber || activeTpl.quotationNumber || "QT-REF-PENDING"}
              </p>
            </div>
          </div>
        );

      case "divider":
        return <div key={idx} className="doc-divider-line"></div>;

      case "metadataGrid":
        return (
          <div key={idx} className="doc-meta-grid">
            <div className="doc-meta-col">
              <span className="doc-meta-label">Prepared for</span>
              <div className="doc-meta-value">
                {leadData?.companyName || leadData?.contactName || metadata.customerName || activeTpl.customerName || "—"}
              </div>
              {(leadData?.contactName || metadata.contactPerson) && (
                <div className="doc-meta-sub">Attn: {leadData?.contactName || metadata.contactPerson}</div>
              )}
              {(leadData?.address || metadata.customerAddress) && (
                <div className="doc-meta-sub">{leadData?.address || metadata.customerAddress}</div>
              )}
            </div>

            <div className="doc-meta-col">
              <span className="doc-meta-label">Quote Date</span>
              <div className="doc-meta-value">
                {quotationDate || metadata.quotationDate || activeTpl.quotationDate || "—"}
              </div>
              {(metadata.validUntil || activeTpl.validUntil) && (
                <div style={{ marginTop: "8px" }}>
                  <span className="doc-meta-label">Valid Until</span>
                  <div className="doc-meta-value">{metadata.validUntil || activeTpl.validUntil}</div>
                </div>
              )}
            </div>

            <div className="doc-meta-col">
              <span className="doc-meta-label">Sales Executive</span>
              <div className="doc-meta-value">
                {salesExecutive || metadata.salesExecutive || activeTpl.salesExecutive || "—"}
              </div>
              {(metadata.salesEmail || activeTpl.salesEmail) && (
                <div className="doc-meta-sub">{metadata.salesEmail || activeTpl.salesEmail}</div>
              )}
              {(metadata.salesPhone || activeTpl.salesPhone) && (
                <div className="doc-meta-sub">{metadata.salesPhone || activeTpl.salesPhone}</div>
              )}
            </div>
          </div>
        );

      case "proposal":
        const proposalBody = proposal.body || activeTpl.introLetterText;
        if (!proposalBody) return null;
        return (
          <div key={idx} className="doc-proposal-section">
            <h3 className="doc-section-heading">
              {proposal.heading || "Commercial Proposal"}
            </h3>
            <p className="doc-proposal-text">{proposalBody}</p>
          </div>
        );

      case "table":
        return (
          <table key={idx} className="doc-items-table">
            <thead>
              <tr>
                {columns.map((col: any, colIdx: number) => (
                  <th key={colIdx} style={{ width: col.width, textAlign: col.align || "left" }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: "center", padding: "18px", color: "#94a3b8", fontStyle: "italic" }}>
                    No line items available in document payload.
                  </td>
                </tr>
              ) : (
                displayItems.map((item: any, rowIdx: number) => (
                  <tr key={rowIdx}>
                    {columns.map((col: any, colIdx: number) => {
                      const key = col.key;
                      let val = item[key];
                      if (key === "item" || key === "slNo" || key === "lineNumber") {
                        val = item.lineNumber || String(rowIdx + 1).padStart(2, '0');
                      }
                      if (key === "description") {
                        val = item.description || item.name || "—";
                      }
                      if (key === "uom") {
                        val = item.uom || item.unit || "—";
                      }
                      if (key === "qty" || key === "quantity") {
                        val = item.qty || item.quantity || 1;
                      }
                      if (key === "unitPrice") {
                        val = `${currency} ${Number(item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                      }
                      if (key === "amount" || key === "price" || key === "total") {
                        const amt = item.amount !== undefined ? item.amount : ((item.qty || 1) * (item.unitPrice || 0));
                        val = `${currency} ${Number(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                      }

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
        );

      case "totals":
        return (
          <div key={idx} className="doc-financials-wrapper">
            <div className="doc-financials-box">
              <div className="doc-financial-row">
                <span style={{ fontWeight: 600 }}>Subtotal</span>
                <span style={{ fontWeight: 700 }}>
                  {currency} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="doc-financial-row">
                  <span style={{ fontWeight: 600 }}>Discount ({(discountRate * 100).toFixed(0)}%)</span>
                  <span style={{ fontWeight: 700 }}>
                    - {currency} {discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="doc-financial-row">
                  <span style={{ fontWeight: 600 }}>VAT ({(taxRate * 100).toFixed(0)}%)</span>
                  <span style={{ fontWeight: 700 }}>
                    {currency} {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="doc-financial-row total-row">
                <span style={{ fontWeight: 800 }}>TOTAL</span>
                <span style={{ fontWeight: 800 }}>
                  {currency} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        );

      case "terms":
        const hasTerms = commercialTerms.paymentTerms || commercialTerms.deliveryTerms || commercialTerms.warrantyTerms || activeTpl.paymentTerms || activeTpl.deliveryTerms || activeTpl.warrantyTerms;
        if (!hasTerms) return null;
        return (
          <div key={idx} className="doc-proposal-section">
            <h3 className="doc-section-heading">Commercial Terms</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: "1px solid var(--border-color)" }}>
              <tbody>
                {(commercialTerms.paymentTerms || activeTpl.paymentTerms) && (
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ width: "150px", padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Payment Terms</td>
                    <td style={{ padding: "8px 12px", color: "#334155" }}>{commercialTerms.paymentTerms || activeTpl.paymentTerms}</td>
                  </tr>
                )}
                {(commercialTerms.deliveryTerms || activeTpl.deliveryTerms) && (
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Delivery</td>
                    <td style={{ padding: "8px 12px", color: "#334155" }}>{commercialTerms.deliveryTerms || activeTpl.deliveryTerms}</td>
                  </tr>
                )}
                {(commercialTerms.warrantyTerms || activeTpl.warrantyTerms) && (
                  <tr>
                    <td style={{ padding: "8px 12px", fontWeight: 700, backgroundColor: "#f8fafc", color: "#0f172a" }}>Warranty</td>
                    <td style={{ padding: "8px 12px", color: "#334155" }}>{commercialTerms.warrantyTerms || activeTpl.warrantyTerms}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );

      case "signatures":
      case "footer":
        const lineList = signatures.lines || activeTpl.signatureLines || ["Authorized Signature"];
        return (
          <div key={idx} className="doc-footer-signatures">
            <div>
              {compName && <p style={{ fontWeight: 700, color: "#1e293b", margin: 0 }}>{compName}</p>}
              {(branding.crNumber || branding.vatNumber || activeTpl.crNumber || activeTpl.vatNumber) && (
                <p style={{ margin: "2px 0 0 0" }}>
                  {(branding.crNumber || activeTpl.crNumber) && `CR: ${branding.crNumber || activeTpl.crNumber}`}
                  {(branding.vatNumber || activeTpl.vatNumber) && ` | VAT: ${branding.vatNumber || activeTpl.vatNumber}`}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "20px" }}>
              {lineList.map((sigText: string, sigIdx: number) => (
                <div key={sigIdx} className="doc-signature-box">
                  <div className="doc-signature-line"></div>
                  <span>{sigText}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="quotation-document-container" style={cssStyleVars}>
      {isReviewMode && (
        <div className="doc-review-required-banner">
          ⚠️ EXTRACTION REVIEW REQUIRED:
          {errors.length > 0 ? (
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          ) : (
            <span> Document details or line items could not be extracted with high confidence. Please verify source file.</span>
          )}
        </div>
      )}

      {layoutElements.map((elem: any, idx: number) => renderElement(elem, idx))}
    </div>
  );
}
