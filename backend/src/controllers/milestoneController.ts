import { Request, Response } from "express";
import { DealMilestone, Deal, PipelineStage } from "@nexus-crm/database";

const DEFAULT_MILESTONES_BY_STAGE: Record<string, string[]> = {
  "New": ["Initial Lead Review", "Contact Info Verification", "First Outreach Attempt"],
  "Contacted": ["Initial Discovery Call", "Needs Assessment", "Stakeholders Identified"],
  "Qualified": ["Budget Confirmation", "Technical Feasibility Validated", "Decision Criteria Aligned"],
  "Meeting/Demo": ["Demo Scheduled", "Custom Demo Completed", "Product Feedback Logged"],
  "Proposal": ["Scope of Work Drafted", "Pricing Approved", "Proposal Delivered to Client"],
  "Negotiation": ["Contract Terms Reviewed", "Legal Approval", "Final Verbal Agreement"],
  "Closed Won": ["Purchase Order Received", "Invoice Generated", "Onboarding Kickoff Scheduled"]
};

export const getDealMilestones = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    let milestones = await DealMilestone.findAll({
      where: { dealId: dealId as string },
      order: [["order", "ASC"], ["createdAt", "ASC"]]
    });

    // Auto-seed default milestones if none exist for this deal
    if (milestones.length === 0) {
      const deal: any = await Deal.findByPk(dealId as string);
      let stageName = "New";
      if (deal && deal.stageId) {
        const stage: any = await PipelineStage.findByPk(deal.stageId);
        if (stage) stageName = stage.name;
      }

      const defaultNames = DEFAULT_MILESTONES_BY_STAGE[stageName] || DEFAULT_MILESTONES_BY_STAGE["Meeting/Demo"];
      
      for (let i = 0; i < defaultNames.length; i++) {
        await DealMilestone.create({
          dealId: dealId as string,
          name: defaultNames[i],
          order: i + 1,
          isCompleted: false
        });
      }

      milestones = await DealMilestone.findAll({
        where: { dealId: dealId as string },
        order: [["order", "ASC"]]
      });
    }

    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleDealMilestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const milestone: any = await DealMilestone.findByPk(id as string);
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });

    milestone.isCompleted = !milestone.isCompleted;
    milestone.completedAt = milestone.isCompleted ? new Date() : null;

    await milestone.save();
    res.json(milestone);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDealMilestone = async (req: Request, res: Response) => {
  try {
    const { dealId, name, dueDate } = req.body;
    if (!dealId || !name) return res.status(400).json({ error: "dealId and name are required" });

    const count = await DealMilestone.count({ where: { dealId } });
    const milestone = await DealMilestone.create({
      dealId,
      name,
      order: count + 1,
      isCompleted: false,
      dueDate: dueDate ? new Date(dueDate) : null
    });

    res.status(201).json(milestone);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
