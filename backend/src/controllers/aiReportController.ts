import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { getScopedUserIds } from "../services/scopeHelper";
import { calculateTeamKpis, calculateUserKpis } from "../services/kpiService";
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const scopedUserIds = await getScopedUserIds(user);

    if (!apiKey || apiKey.startsWith("your_") || apiKey === "mock") {
      // Mock mode: Query the DB directly and formulate a text response
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

      return res.json({
        text: `[AI MOCK MODE] Here is the real-time scoped report for ${user.name} (Role: ${user.role}):
- **Active Deals**: ${activeDealsCount}
- **Total Pipeline Value**: $${totalPipelineValue.toLocaleString()}
- **Total Won Revenue**: $${totalWonAmount.toLocaleString()}
- **Win Close Rate**: ${teamCloseRate.toFixed(1)}%

**Pipeline Distribution:**
${Object.entries(stageCounts).map(([stage, count]) => `- **${stage}**: ${count} deals`).join('\n')}

*(Note: Set a valid ANTHROPIC_API_KEY in your .env file to enable full chat capability).*`
      });
    }

    // Define tools
    const tools = [
      {
        name: "getKpiSummary",
        description: "Get KPI summary metrics for the team/users this user has access to.",
        input_schema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "getPipelineSummary",
        description: "Get summary of pipeline stages and counts/amounts of deals in progress.",
        input_schema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "getRevenueByPeriod",
        description: "Get revenue (won deal amounts) grouped by period (e.g. month or week).",
        input_schema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["month", "week"],
              description: "The grouping period: month or week"
            }
          },
          required: ["period"]
        }
      }
    ];

    // Format chat history for Anthropic (only keeping role and content)
    const formattedMessages = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

    // Step 1: Initial call to Anthropic with tools
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1524,
        system: `You are the Nexus CRM AI Assistant. You have access to tools that query the user's CRM database. You must ONLY answer questions based on the tool results. Enforce data security and role boundaries (which are already pre-scoped for this user). Current user: ${user.name} (Role: ${user.role}).`,
        messages: formattedMessages,
        tools
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Anthropic API error: ${errText}` });
    }

    let resultJson = await response.json();
    
    // Check if the assistant wants to call any tool
    if (resultJson.stop_reason === "tool_use") {
      const toolUseBlock = resultJson.content.find((c: any) => c.type === "tool_use");
      if (toolUseBlock) {
        const { name, input, id: toolUseId } = toolUseBlock;
        let toolResult: any;

        // Execute the tool under strict role scoping
        try {
          if (name === "getKpiSummary") {
            const teamKpis = await calculateTeamKpis(scopedUserIds);
            toolResult = {
              totalPipelineValue: teamKpis?.totalPipelineValue || 0,
              totalWonAmount: teamKpis?.totalWonAmount || 0,
              teamCloseRate: teamKpis?.teamCloseRate || 0,
              activeDealsCount: teamKpis?.activeDealsCount || 0
            };
          } else if (name === "getPipelineSummary") {
            const deals = await sequelize.models.Deal.findAll({
              where: { ownerId: { [Op.in]: scopedUserIds } },
              include: [{ model: sequelize.models.PipelineStage, as: 'stage' }]
            });
            const funnelStages = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"];
            toolResult = funnelStages.map(stageName => {
              const stageDeals = deals.filter((d: any) => d.stage?.name === stageName);
              return {
                stage: stageName,
                count: stageDeals.length,
                value: stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
              };
            });
          } else if (name === "getRevenueByPeriod") {
            const period = input.period || "month";
            const deals = await sequelize.models.Deal.findAll({
              where: { 
                ownerId: { [Op.in]: scopedUserIds },
                createdAt: { [Op.ne]: null }
              },
              include: [{ model: sequelize.models.PipelineStage, as: 'stage' }]
            });

            const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
            const revenueMap: Record<string, number> = {};

            wonDeals.forEach((d: any) => {
              const date = new Date(d.createdAt);
              let key = "";
              if (period === "month") {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
              } else {
                // Calculate week number
                const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
                const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
                const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
                key = `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
              }
              revenueMap[key] = (revenueMap[key] || 0) + Number(d.amount || 0);
            });

            toolResult = Object.entries(revenueMap).map(([key, value]) => ({ period: key, revenue: value }));
          } else {
            toolResult = { error: "Unknown tool" };
          }
        } catch (toolErr: any) {
          toolResult = { error: toolErr.message };
        }

        // Send the tool results back to Anthropic to get the final assistant text
        const finalMessages = [
          ...formattedMessages,
          { role: "assistant", content: resultJson.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseId,
                content: JSON.stringify(toolResult)
              }
            ]
          }
        ];

        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1524,
            system: `You are the Nexus CRM AI Assistant. Present the requested data.`,
            messages: finalMessages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(502).json({ error: `Anthropic API error after tool invocation: ${errText}` });
        }

        resultJson = await response.json();
      }
    }

    // Extract text from the final response
    const assistantText = resultJson.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    res.json({ text: assistantText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
