import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { getScopedUserIds } from "../services/scopeHelper";
import { calculateTeamKpis } from "../services/kpiService";
import { Op } from "sequelize";

export const queryAiReport = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const scopedUserIds = await getScopedUserIds(user);

    // Fetch DB context for analysis
    const teamKpis = await calculateTeamKpis(scopedUserIds);
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: { [Op.in]: scopedUserIds } },
      include: [{ model: sequelize.models.PipelineStage, as: 'stage' }]
    });

    const totalPipelineValue = teamKpis?.totalPipelineValue || 0;
    const totalWonAmount = teamKpis?.totalWonAmount || 0;
    const teamCloseRate = teamKpis?.teamCloseRate || 0;
    const activeDealsCount = teamKpis?.activeDealsCount || 0;

    const stageCounts = deals.reduce((acc: any, d: any) => {
      const stageName = d.stage?.name || 'Unknown';
      acc[stageName] = (acc[stageName] || 0) + 1;
      return acc;
    }, {});

    const contextText = `User: ${user.name} (Role: ${user.role})
Current Scoped Metrics:
- Active Deals: ${activeDealsCount}
- Total Pipeline Value: $${totalPipelineValue.toLocaleString()}
- Total Won Revenue: $${totalWonAmount.toLocaleString()}
- Win Close Rate: ${teamCloseRate.toFixed(1)}%
Pipeline Breakdown:
${Object.entries(stageCounts).map(([stage, count]) => `- ${stage}: ${count} deals`).join('\n')}`;

    // 1. FREE GROQ API OPTION (Llama-3.3-70B)
    if (groqKey && !groqKey.startsWith("your_")) {
      const groqMessages = [
        { role: "system", content: `You are the Nexus CRM AI Executive Assistant. Answer based on this CRM data:\n${contextText}` },
        ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
      ];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          max_tokens: 1024
        })
      });

      if (response.ok) {
        const json = await response.json();
        return res.json({ text: json.choices[0].message.content });
      }
    }

    // 2. FREE GOOGLE GEMINI API OPTION
    if (geminiKey && !geminiKey.startsWith("your_")) {
      const lastUserMsg = messages[messages.length - 1]?.content || "Provide an overview of our sales pipeline.";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `System Context: You are the Nexus CRM AI Assistant.\n${contextText}\n\nUser Question: ${lastUserMsg}`
            }]
          }]
        })
      });

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates[0].content.parts[0].text;
        return res.json({ text });
      }
    }

    // 3. ANTHROPIC API OPTION
    if (anthropicKey && !anthropicKey.startsWith("your_") && anthropicKey !== "mock") {
      const formattedMessages = messages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          system: `You are the Nexus CRM AI Assistant.\n${contextText}`,
          messages: formattedMessages
        })
      });

      if (response.ok) {
        const resultJson = await response.json();
        const assistantText = resultJson.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
        return res.json({ text: assistantText });
      }
    }

    // 4. BUILT-IN FREE CRM ANALYTICS ENGINE (NO API KEY NEEDED)
    return res.json({
      text: `🤖 **Nexus Real-Time Scoped AI Report**
User: **${user.name}** | Role: **${user.role}**

- **Active Deals**: ${activeDealsCount}
- **Total Pipeline Value**: $${totalPipelineValue.toLocaleString()}
- **Total Won Revenue**: $${totalWonAmount.toLocaleString()}
- **Win Close Rate**: ${teamCloseRate.toFixed(1)}%

📊 **Pipeline Stage Breakdown:**
${Object.entries(stageCounts).map(([stage, count]) => `• **${stage}**: ${count} deal(s)`).join('\n')}

💡 *Tip: For custom AI chat queries, add a FREE **GROQ_API_KEY** (from console.groq.com) or **GEMINI_API_KEY** (from aistudio.google.com) to your \`.env\` file.*`
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
