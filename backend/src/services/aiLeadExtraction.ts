export interface ExtractedLeadDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  subject?: string;
  industry?: string;
  budgetRange?: string;
}

/**
 * Shared AI Lead Extraction Cascade:
 * 1. Groq API (Llama-3.3-70B)
 * 2. Google Gemini API (gemini-1.5-flash)
 * 3. OpenRouter API (meta-llama/llama-3.3-70b-instruct:free)
 * 4. Free Heuristic Fallback
 */
export async function extractLeadDetailsFromText(text: string): Promise<ExtractedLeadDetails> {
  if (!text || typeof text !== "string") {
    return { message: text || "" };
  }

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // 1. FREE GROQ API OPTION (Llama-3.3-70B)
  if (groqKey && !groqKey.startsWith("your_")) {
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
            {
              role: "system",
              content: "You are a lead detail extraction assistant. Return ONLY a raw JSON object with keys: firstName, lastName, email, phone, company, message, subject, industry, budgetRange."
            },
            {
              role: "user",
              content: `Extract lead details from this text: "${text}"`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (response.ok) {
        const json = await response.json() as any;
        const parsed = JSON.parse(json.choices[0].message.content);
        return parsed;
      }
    } catch (err) {
      console.warn("[AI Lead Extraction] Groq extraction failed, falling back:", err);
    }
  }

  // 2. FREE GOOGLE GEMINI API OPTION
  if (geminiKey && !geminiKey.startsWith("your_")) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extract lead details from this text and return ONLY valid JSON with keys: firstName, lastName, email, phone, company, message, subject, industry, budgetRange. Text: "${text}"`
            }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const json = await response.json() as any;
        const rawText = json.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(rawText);
        return parsed;
      }
    } catch (err) {
      console.warn("[AI Lead Extraction] Gemini extraction failed, falling back:", err);
    }
  }

  // 3. OPENROUTER API OPTION (Free Tier)
  // Note: OpenRouter free model IDs ending in :free (e.g. meta-llama/llama-3.3-70b-instruct:free)
  // may rotate over time and should be periodically verified against https://openrouter.ai/models
  if (openrouterKey && !openrouterKey.startsWith("your_")) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.BASE_URL || "http://localhost:5506",
          "X-Title": process.env.COMPANY_NAME || "Nexus Enterprise CRM"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            {
              role: "system",
              content: "You are a lead detail extraction assistant. Return ONLY a raw JSON object with keys: firstName, lastName, email, phone, company, message, subject, industry, budgetRange."
            },
            {
              role: "user",
              content: `Extract lead details from this text: "${text}"`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (response.ok) {
        const json = await response.json() as any;
        const parsed = JSON.parse(json.choices[0].message.content);
        return parsed;
      }
    } catch (err) {
      console.warn("[AI Lead Extraction] OpenRouter extraction failed, falling back:", err);
    }
  }

  // 4. BUILT-IN FREE HEURISTIC PARSER (NO API KEY REQUIRED)
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,6}/);
  const email = emailMatch ? emailMatch[0] : "";
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // 4A. Name Extraction
  let firstName = "";
  let lastName = "";
  
  const namePatterns = [
    /(?:this is|i am|i'm|my name is|speaking is|name is|it's|it is)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*?)(?=\s+(?:from|at|with|here|representing|\.|\,|$))/i,
    /(?:^|\b)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:here\s+)?from\b/i,
    /(?:this is|i am|i'm|my name is|speaking is|name is)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)/i
  ];

  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const rawName = m[1].trim();
      const parts = rawName.split(/\s+/);
      if (parts.length > 0) firstName = parts[0];
      if (parts.length > 1) lastName = parts.slice(1).join(" ");
      break;
    }
  }

  // Fallback name from email if not extracted
  if (!firstName && email) {
    const localPart = email.split("@")[0].replace(/[._-]/g, " ");
    const parts = localPart.split(/\s+/);
    firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    if (parts.length > 1) {
      lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
  }

  // 4B. Company Extraction (supports multi-word companies like "Emirates Global Steel")
  let company = "";
  const companyPatterns = [
    /(?:from|at|with|representing|company(?:\s+is)?)\s+([A-Z0-9][A-Za-z0-9&.,'’\s-]+?)(?=(?:,|\.|\band\b|\bmy\b|\bwe\b|\bour\b|\bemail\b|\bphone\b|\bwith\b|\bcontact\b|\bbudget\b|$))/i,
    /(?:works?\s+at|calling\s+from)\s+([A-Z0-9][A-Za-z0-9&.,'’\s-]+?)(?=(?:,|\.|\band\b|\bmy\b|\bwe\b|\bour\b|\bemail\b|\bphone\b|$))/i
  ];

  for (const pat of companyPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/[.,;:]+$/, "");
      if (candidate && candidate.length > 1 && !/^(the|a|an|my|our)$/i.test(candidate)) {
        company = candidate;
        break;
      }
    }
  }

  // 4C. Budget Extraction (handles "budget of SAR 350,000", "$450k", "500,000 USD", etc.)
  let budgetRange = "";
  const budgetPatterns = [
    /(?:budget|amount|cost|quote|worth|estimate|value)\s*(?:of|is|:)?\s*([a-zA-Z$€£]*\s*[\d,]+(?:\.\d+)?\s*(?:k|thousand|million|m|sar|usd|eur|aed|inr|gbp)?)/i,
    /(?:sar|usd|aed|eur|gbp|\$|€|£)\s*[\d,]+(?:\.\d+)?\s*(?:k|thousand|million|m)?/i,
    /[\d,]+(?:\.\d+)?\s*(?:k|thousand|million|m)\s*(?:sar|usd|aed|eur|gbp|\$|€|£)?/i
  ];

  for (const pat of budgetPatterns) {
    const m = text.match(pat);
    if (m) {
      budgetRange = (m[1] || m[0]).trim();
      break;
    }
  }

  // 4D. Industry Detection
  let industry = "General";
  if (/steel|fabrication|metal|machinery|industrial|factory|tanks|generators|equipment/i.test(text)) {
    industry = "Heavy Industry & Manufacturing";
  } else if (/site office|construction|cabin|building|civil|contracting|infrastructure|camp/i.test(text)) {
    industry = "Construction & Modular Facilities";
  } else if (/software|app|crm|tech|cloud|it\b/i.test(text)) {
    industry = "Technology & Software";
  } else if (/petroleum|oil|gas|petrochemical|refinery/i.test(text)) {
    industry = "Oil & Gas";
  }

  let subject = text.length > 60 ? text.slice(0, 57) + "..." : text;

  return {
    firstName: firstName || "Inquiry",
    lastName: lastName || "Lead",
    email: email || "voice.lead@example.com",
    phone: phone || "555-0199",
    company: company || (firstName ? `${firstName}'s Company` : "General Inquirer"),
    message: text,
    subject,
    industry,
    budgetRange
  };
}
