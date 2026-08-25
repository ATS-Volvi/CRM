import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export interface StructuredRequirementSummary {
  coreRequest: string;
  primaryDeliverables: string[];
  technicalSpecs: string[];
  projectContext?: string | null;
  timelineAndConstraints?: string | null;
  budgetAndCommercials?: string | null;
  recommendedAction: string;
  keyTags: string[];
  intentScore: number;
  clientHistory?: {
    totalPastRevenue: number;
    previousPurchases: any[];
    previousReps: any[];
  };
  rawSummaryText: string;
}

/**
 * Intelligent deterministic extractor when no AI API keys are configured or network fails.
 * Filters out conversational chatter and extracts only concrete deliverables, specs, budget, and context.
 */
function deterministicRequirementExtractor(context: {
  name?: string;
  company?: string;
  industry?: string;
  budgetRange?: string;
  notes?: string;
  extractedRequirement?: any;
  messagesText?: string;
  quotesText?: string;
}): StructuredRequirementSummary {
  const combined = `${context.extractedRequirement?.item || ""} ${context.notes || ""} ${context.messagesText || ""} ${context.quotesText || ""}`.trim();
  
  // 1. Deliverables & Items extraction
  const deliverables: string[] = [];
  const reqObj = context.extractedRequirement;
  if (reqObj && typeof reqObj === "object" && reqObj.item) {
    const qty = reqObj.quantity ? `${reqObj.quantity}x ` : "";
    deliverables.push(`${qty}${reqObj.item}`);
  }

  // Regex patterns for line items and quantities: e.g. "25 distribution panels", "50 valves", "1000m cables"
  const itemMatches = combined.match(/\b(?:\d+[\s-]*(?:units?|pcs?|panels?|valves?|licenses?|sets?|meters?|tons?|switches?|meters?|modules?|pumps?|sensors?|cables?|lines?|cabinets?|enclosures?)|(?:need|looking for|require|supply of|procurement of)\s+[^,.\n]+)/gi);
  if (itemMatches) {
    itemMatches.forEach(m => {
      const clean = m.trim().replace(/^(?:need|looking for|require|supply of|procurement of)\s+/i, "");
      if (clean.length > 3 && !deliverables.some(d => d.toLowerCase().includes(clean.toLowerCase()))) {
        deliverables.push(clean.charAt(0).toUpperCase() + clean.slice(1));
      }
    });
  }

  if (deliverables.length === 0) {
    deliverables.push(context.industry ? `Standard ${context.industry} Commercial Equipment` : "Standard Commercial Quotation Package");
  }

  // 2. Technical specs extraction
  const specs: string[] = [];
  const specPatterns = [
    /\b(?:\d+\s*(?:v|kv|kw|mw|amp|a|hp|bar|psi|hz|kva|rpm))\b/gi,
    /\b(?:ip\d{2}|ul|ce|iso\s*\d+|iec|scada|modbus|stainless steel|heavy duty|explosion proof|fire rated|weatherproof|automated|smart|plc)\b/gi
  ];
  for (const pat of specPatterns) {
    const found = combined.match(pat);
    if (found) {
      found.forEach(s => {
        const u = s.toUpperCase().trim();
        if (!specs.includes(u)) specs.push(u);
      });
    }
  }
  if (specs.length === 0) {
    specs.push("Standard Commercial Tier Specifications", "Standard Industrial Warranty");
  }

  // 3. Project Context
  let projContext = reqObj?.context || null;
  if (!projContext) {
    const ctxMatch = combined.match(/(?:for\s+(?:our|the|a)?\s*)([A-Za-z0-9\s]+?(?:plant\s+expansion|expansion|plant|factory|warehouse|project|facility|datacenter|refinery|infrastructure|site|deployment))/i);
    if (ctxMatch) projContext = ctxMatch[1].trim();
  }

  // 4. Budget & Commercials
  let budget = context.budgetRange || "Standard Catalogue Rates";
  const budgetMatch = combined.match(/(?:budget|amount|cost|quote|worth|estimate|value)\s*(?:of|is|:)?\s*([a-zA-Z$€£]*\s*[\d,]+(?:\.\d+)?\s*(?:k|thousand|million|m|sar|usd|eur|aed)?)/i);
  if (budgetMatch) budget = budgetMatch[0].trim();

  // 5. Key Tags
  const keyTags: string[] = [
    context.industry || "General",
    ...deliverables.slice(0, 2).map(d => d.replace(/^\d+x\s*/, "")),
    ...specs.slice(0, 2)
  ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 5);

  const coreRequest = `Client is requesting official pricing for ${deliverables.slice(0, 3).join(", ")}${projContext ? ` for ${projContext}` : ""}.`;
  const recommendedAction = "Prepare and email an itemized commercial quotation with volume tiered options.";

  const rawSummaryText = `• **Core Deliverables**: ${deliverables.join(", ")}\n• **Key Specifications**: ${specs.join(", ")}\n• **Project Scope**: ${projContext || 'General commercial procurement'}\n• **Commercial Budget**: ${budget}\n• **Action Plan**: ${recommendedAction}`;

  return {
    coreRequest,
    primaryDeliverables: deliverables.slice(0, 5),
    technicalSpecs: specs.slice(0, 6),
    projectContext: projContext || "Commercial Procurement Scope",
    timelineAndConstraints: "Standard 30-day quote validity and standard manufacturing delivery lead-time",
    budgetAndCommercials: budget,
    recommendedAction,
    keyTags,
    intentScore: 85,
    rawSummaryText
  };
}

/**
 * Synthesizes clear, structured, filtered requirements for a Lead.
 */
export async function synthesizeLeadRequirements(leadId: string): Promise<StructuredRequirementSummary> {
  const lead: any = await sequelize.models.Lead.findByPk(leadId);

  if (!lead) {
    throw new Error(`Lead #${leadId} not found`);
  }

  // Fetch linked messages / activities
  const messages = await sequelize.models.Activity.findAll({
    where: { leadId },
    order: [["createdAt", "ASC"]],
    limit: 25
  });

  const messagesText = messages.map((m: any) => `${m.direction === 'inbound' ? 'Customer' : 'Staff'}: ${m.notes || m.outcome || ''}`).join("\n");

  // Fetch client purchase / quote history
  let clientHistory = {
    totalPastRevenue: 0,
    previousPurchases: [] as any[],
    previousReps: [] as any[]
  };

  if (lead.email || lead.company) {
    const pastLeads = await sequelize.models.Lead.findAll({
      where: {
        [Op.or]: [
          ...(lead.email ? [{ email: lead.email }] : []),
          ...(lead.company ? [{ company: lead.company }] : [])
        ]
      },
      attributes: ["id", "assignedToId"]
    });
    const leadIds = pastLeads.map((pl: any) => pl.id);
    const deals = await sequelize.models.Deal.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      attributes: ["id", "name"]
    });
    const dealIds = deals.map((d: any) => d.id);
    if (dealIds.length > 0) {
      const quotes = await sequelize.models.Quote.findAll({
        where: { dealId: { [Op.in]: dealIds } },
        order: [["createdAt", "DESC"]]
      });
      clientHistory.previousPurchases = quotes.map((q: any) => ({
        id: q.id,
        quoteNumber: q.quoteNumber || "Q-2026",
        amount: parseFloat(q.totalAmount || "0"),
        status: q.status,
        date: q.createdAt
      }));
      clientHistory.totalPastRevenue = clientHistory.previousPurchases
        .filter(p => p.status === "Accepted" || p.status === "Approved")
        .reduce((sum, p) => sum + p.amount, 0);
    }
  }

  const contextData = {
    name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
    company: lead.company,
    industry: lead.industry,
    budgetRange: lead.budgetRange,
    notes: `${lead.message || ''} ${lead.sourceDetail || ''} ${lead.notes || ''}`.trim(),
    extractedRequirement: lead.extractedRequirement,
    messagesText
  };

  // Attempt LLM Synthesis
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `You are an elite enterprise B2B sales engineer and requirement analyst.
Analyze the lead's enquiry and conversation history. Filter out all conversational greetings, pleasantries, delivery logistics small-talk, and administrative chatter.
Extract ONLY the core, concrete technical and commercial requirements.

Return a valid JSON object matching this exact schema:
{
  "coreRequest": "Single crisp sentence defining what the client needs",
  "primaryDeliverables": ["Item/Product 1 with quantity/model", "Item 2..."],
  "technicalSpecs": ["Spec/Standard/Rating 1", "Spec 2..."],
  "projectContext": "Context or location of deployment",
  "timelineAndConstraints": "Delivery timeline or constraints",
  "budgetAndCommercials": "Budget details or target pricing",
  "recommendedAction": "Concrete recommended quotation/sales action",
  "keyTags": ["Tag1", "Tag2", "Tag3"],
  "intentScore": 88
}`;

  if (groqKey && !groqKey.startsWith("your_")) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Lead Context:\n${JSON.stringify(contextData, null, 2)}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 600
        })
      });
      if (res.ok) {
        const json = await res.json() as any;
        const parsed = JSON.parse(json.choices[0].message.content);
        return {
          ...parsed,
          clientHistory,
          rawSummaryText: `• **Core Deliverables**: ${(parsed.primaryDeliverables || []).join(", ")}\n• **Key Specifications**: ${(parsed.technicalSpecs || []).join(", ")}\n• **Project Scope**: ${parsed.projectContext || 'Enterprise supply'}\n• **Commercial Budget**: ${parsed.budgetAndCommercials || 'N/A'}\n• **Action Plan**: ${parsed.recommendedAction || 'Send official quote via email'}`
        };
      }
    } catch (e: any) {
      console.warn("Groq requirement synthesis note:", e.message);
    }
  }

  if (geminiKey && !geminiKey.startsWith("your_")) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nLead Context:\n${JSON.stringify(contextData, null, 2)}`
            }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (res.ok) {
        const json = await res.json() as any;
        const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
        return {
          ...parsed,
          clientHistory,
          rawSummaryText: `• **Core Deliverables**: ${(parsed.primaryDeliverables || []).join(", ")}\n• **Key Specifications**: ${(parsed.technicalSpecs || []).join(", ")}\n• **Project Scope**: ${parsed.projectContext || 'Enterprise supply'}\n• **Commercial Budget**: ${parsed.budgetAndCommercials || 'N/A'}\n• **Action Plan**: ${parsed.recommendedAction || 'Send official quote via email'}`
        };
      }
    } catch (e: any) {
      console.warn("Gemini requirement synthesis note:", e.message);
    }
  }

  // Fallback to deterministic requirement extractor
  const deterministic = deterministicRequirementExtractor(contextData);
  return {
    ...deterministic,
    clientHistory
  };
}

/**
 * Synthesizes clear, structured, filtered requirements for an Opportunity/Deal.
 */
export async function synthesizeOpportunityRequirements(opportunityId: string): Promise<StructuredRequirementSummary> {
  const deal: any = await sequelize.models.Deal.findByPk(opportunityId, {
    include: [
      { model: sequelize.models.Lead, as: "lead", required: false },
      { model: sequelize.models.Account, as: "account", required: false },
      { model: sequelize.models.PipelineStage, as: "stage", required: false }
    ]
  });

  if (!deal) {
    throw new Error(`Opportunity #${opportunityId} not found`);
  }

  const quotes: any[] = await sequelize.models.Quote.findAll({
    where: { dealId: opportunityId },
    include: [
      {
        model: sequelize.models.QuoteLineItem,
        as: "QuoteLineItems",
        include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
      }
    ],
    order: [["version", "DESC"]]
  });

  const quotesText = quotes.map(q => {
    const items = (q.QuoteLineItems || []).map((li: any) => `${li.quantity}x ${li.product?.name || li.description || 'Product'} (SAR ${li.unitPrice})`).join("; ");
    return `Quote #${q.quoteNumber} (v${q.version}, ${q.status}, Total: SAR ${q.totalAmount}): ${items}`;
  }).join("\n");

  const lead = deal.lead;
  const contextData = {
    name: deal.name,
    company: deal.account?.name || lead?.company || "Enterprise Account",
    industry: lead?.industry || "General Industry",
    budgetRange: deal.amount ? `SAR ${Number(deal.amount).toLocaleString()}` : lead?.budgetRange,
    notes: `${deal.notes || ''} ${lead?.message || ''}`.trim(),
    extractedRequirement: lead?.extractedRequirement,
    quotesText
  };

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `You are a chief commercial officer and senior sales engineer.
Analyze this enterprise sales opportunity. Filter out all administrative noise and conversation pleasantries.
Extract and summarize ONLY the core, high-priority technical and commercial requirements needed to win the deal.

Return a valid JSON object matching this exact schema:
{
  "coreRequest": "Single crisp sentence defining the commercial opportunity requirements",
  "primaryDeliverables": ["Item/Product 1 with quantity/model", "Item 2..."],
  "technicalSpecs": ["Spec/Standard/Rating 1", "Spec 2..."],
  "projectContext": "Context, deployment site, or commercial scope",
  "timelineAndConstraints": "Delivery timeline or procurement deadlines",
  "budgetAndCommercials": "Opportunity value, pricing sensitivity, or discount terms",
  "recommendedAction": "Concrete recommended next commercial/quotation step",
  "keyTags": ["Tag1", "Tag2", "Tag3"],
  "intentScore": 92
}`;

  if (groqKey && !groqKey.startsWith("your_")) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Opportunity Context:\n${JSON.stringify(contextData, null, 2)}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 600
        })
      });
      if (res.ok) {
        const json = await res.json() as any;
        const parsed = JSON.parse(json.choices[0].message.content);
        return {
          ...parsed,
          rawSummaryText: `• **Core Deliverables**: ${(parsed.primaryDeliverables || []).join(", ")}\n• **Key Specifications**: ${(parsed.technicalSpecs || []).join(", ")}\n• **Project Scope**: ${parsed.projectContext || 'Enterprise deal'}\n• **Commercial Budget**: ${parsed.budgetAndCommercials || 'N/A'}\n• **Action Plan**: ${parsed.recommendedAction || 'Execute quotation negotiation via email'}`
        };
      }
    } catch (e: any) {
      console.warn("Groq opportunity requirement synthesis note:", e.message);
    }
  }

  if (geminiKey && !geminiKey.startsWith("your_")) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nOpportunity Context:\n${JSON.stringify(contextData, null, 2)}`
            }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (res.ok) {
        const json = await res.json() as any;
        const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
        return {
          ...parsed,
          rawSummaryText: `• **Core Deliverables**: ${(parsed.primaryDeliverables || []).join(", ")}\n• **Key Specifications**: ${(parsed.technicalSpecs || []).join(", ")}\n• **Project Scope**: ${parsed.projectContext || 'Enterprise deal'}\n• **Commercial Budget**: ${parsed.budgetAndCommercials || 'N/A'}\n• **Action Plan**: ${parsed.recommendedAction || 'Execute quotation negotiation via email'}`
        };
      }
    } catch (e: any) {
      console.warn("Gemini opportunity requirement synthesis note:", e.message);
    }
  }

  return deterministicRequirementExtractor(contextData);
}
