import { Request, Response } from "express";

export const parseVoiceLead = async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required and must be a string." });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith("your_") || apiKey === "mock") {
      // Mock/local regex parser fallback
      const emailMatch = transcript.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      const phoneMatch = transcript.match(/(\+?\d[\d-\s()]{7,}\d)/);
      const words = transcript.split(/\s+/);
      
      const email = emailMatch ? emailMatch[0] : "voice.lead@example.com";
      const phone = phoneMatch ? phoneMatch[0] : "555-0199";
      
      // Simple name extraction heuristic
      let firstName = "Voice";
      let lastName = "Lead";
      const myNameIsIndex = transcript.toLowerCase().indexOf("my name is");
      if (myNameIsIndex !== -1) {
        const afterName = transcript.substring(myNameIsIndex + 10).trim();
        const nameParts = afterName.split(/\s+/);
        if (nameParts.length > 0) firstName = nameParts[0].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        if (nameParts.length > 1) lastName = nameParts[1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      }

      // Simple company extraction heuristic
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
    }

    const tools = [
      {
        name: "extractLeadDetails",
        description: "Extract structured lead fields from a transcript.",
        input_schema: {
          type: "object",
          properties: {
            firstName: { type: "string", description: "The lead's first name, or empty string if not found." },
            lastName: { type: "string", description: "The lead's last name, or empty string if not found." },
            email: { type: "string", description: "The lead's email, or empty string if not found." },
            phone: { type: "string", description: "The lead's phone number, or empty string if not found." },
            company: { type: "string", description: "The lead's company, or empty string if not found." },
            message: { type: "string", description: "The detailed inquiry notes or message summary." },
            industry: { type: "string", description: "The industry field, or empty string if not found." },
            budgetRange: { type: "string", description: "Estimated budget, e.g., '$10k-$50k' or similar." }
          },
          required: ["firstName", "lastName", "email"]
        }
      }
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        system: "Extract lead details from the user's transcript. You MUST call the extractLeadDetails tool.",
        messages: [
          { role: "user", content: `Here is the transcript: "${transcript}"` }
        ],
        tools,
        tool_choice: { type: "tool", name: "extractLeadDetails" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Anthropic API error: ${errText}` });
    }

    const resultJson = await response.json();
    const toolUseBlock = resultJson.content.find((c: any) => c.type === "tool_use");

    if (toolUseBlock && toolUseBlock.name === "extractLeadDetails") {
      res.json(toolUseBlock.input);
    } else {
      res.status(500).json({ error: "Failed to extract lead details from the voice transcript." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
