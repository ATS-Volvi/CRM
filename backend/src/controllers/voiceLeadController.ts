import { Request, Response } from "express";

export const parseVoiceLead = async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required and must be a string." });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. FREE GROQ API OPTION (Llama-3.3-70B)
    if (groqKey && !groqKey.startsWith("your_")) {
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
              content: "You are a lead detail extraction assistant. Return ONLY a raw JSON object with keys: firstName, lastName, email, phone, company, message, industry, budgetRange."
            },
            {
              role: "user",
              content: `Extract lead details from this transcript: "${transcript}"`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const parsed = JSON.parse(json.choices[0].message.content);
        return res.json(parsed);
      }
    }

    // 2. FREE GOOGLE GEMINI API OPTION
    if (geminiKey && !geminiKey.startsWith("your_")) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extract lead details from this transcript and return ONLY valid JSON with keys: firstName, lastName, email, phone, company, message, industry, budgetRange. Transcript: "${transcript}"`
            }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        return res.json(parsed);
      }
    }

    // 3. ANTHROPIC API OPTION
    if (anthropicKey && !anthropicKey.startsWith("your_") && anthropicKey !== "mock") {
      const tools = [
        {
          name: "extractLeadDetails",
          description: "Extract structured lead fields from a transcript.",
          input_schema: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              company: { type: "string" },
              message: { type: "string" },
              industry: { type: "string" },
              budgetRange: { type: "string" }
            },
            required: ["firstName", "lastName", "email"]
          }
        }
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 800,
          system: "Extract lead details from transcript. You MUST call the extractLeadDetails tool.",
          messages: [{ role: "user", content: `Here is transcript: "${transcript}"` }],
          tools,
          tool_choice: { type: "tool", name: "extractLeadDetails" }
        })
      });

      if (response.ok) {
        const resultJson = await response.json();
        const toolUseBlock = resultJson.content.find((c: any) => c.type === "tool_use");
        if (toolUseBlock) return res.json(toolUseBlock.input);
      }
    }

    // 4. BUILT-IN FREE HEURISTIC PARSER (NO API KEY REQUIRED)
    const emailMatch = transcript.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const phoneMatch = transcript.match(/(\+?\d[\d-\s()]{7,}\d)/);
    const email = emailMatch ? emailMatch[0] : "voice.lead@example.com";
    const phone = phoneMatch ? phoneMatch[0] : "555-0199";
    
    let firstName = "Voice";
    let lastName = "Lead";
    const myNameIsIndex = transcript.toLowerCase().indexOf("my name is");
    if (myNameIsIndex !== -1) {
      const afterName = transcript.substring(myNameIsIndex + 10).trim();
      const nameParts = afterName.split(/\s+/);
      if (nameParts.length > 0) firstName = nameParts[0].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      if (nameParts.length > 1) lastName = nameParts[1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    }

    let company = "Voice Inc";
    const atCompanyIndex = transcript.toLowerCase().indexOf(" at ");
    if (atCompanyIndex !== -1) {
      const afterCompany = transcript.substring(atCompanyIndex + 4).trim();
      const companyParts = afterCompany.split(/\s+/);
      if (companyParts.length > 0) company = companyParts[0].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    }

    return res.json({
      firstName,
      lastName,
      email,
      phone,
      company,
      message: transcript,
      industry: "Technology",
      budgetRange: "$10k-$50k"
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
