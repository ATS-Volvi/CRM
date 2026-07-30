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
  const phoneMatch = text.match(/(\+?\d[\d-\s()]{7,}\d)/);
  const email = emailMatch ? emailMatch[0] : "voice.lead@example.com";
  const phone = phoneMatch ? phoneMatch[0] : "555-0199";

  let firstName = "Voice";
  let lastName = "Lead";
  const myNameIsIndex = text.toLowerCase().indexOf("my name is");
  if (myNameIsIndex !== -1) {
    const afterName = text.substring(myNameIsIndex + 10).trim();
    const nameParts = afterName.split(/\s+/);
    if (nameParts.length > 0) firstName = nameParts[0].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    if (nameParts.length > 1) lastName = nameParts[1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  }

  let company = "";
  const atCompanyIndex = text.toLowerCase().indexOf(" at ");
  if (atCompanyIndex !== -1) {
    const afterCompany = text.substring(atCompanyIndex + 4).trim();
    const companyParts = afterCompany.split(/\s+/);
    if (companyParts.length > 0) company = companyParts[0].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  }

  // Heuristic requirement & budget extraction
  let budgetRange = "";
  const budgetMatch = text.match(/(?:budget|around|cost|approx|for|~)\s*(\$?\d+[\d,]*\s*(?:k|thousand|million|m|sar|usd|eur)?)/i);
  if (budgetMatch) {
    budgetRange = budgetMatch[1].trim();
  }

  let industry = "General";
  if (/site office|construction|cabin|building/i.test(text)) {
    industry = "Construction & Modular Buildings";
  } else if (/software|app|crm|tech/i.test(text)) {
    industry = "Technology";
  }

  let subject = text.length > 60 ? text.slice(0, 57) + "..." : text;

  return {
    firstName,
    lastName,
    email,
    phone,
    company: company || "Voice Inc",
    message: text,
    subject,
    industry,
    budgetRange
  };
}
