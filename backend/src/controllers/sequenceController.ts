import { Request, Response } from "express";
import { Sequence, SequenceStep, SequenceEnrollment, Lead, Customer, Activity } from "@nexus-crm/database";

export const getSequences = async (req: Request, res: Response) => {
  try {
    const sequences = await Sequence.findAll({
      include: [{ model: SequenceStep, as: "steps" }],
      order: [["createdAt", "DESC"]]
    });
    res.json(sequences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSequence = async (req: Request, res: Response) => {
  try {
    const { name, triggerEvent, steps } = req.body;
    if (!name) return res.status(400).json({ error: "Sequence name is required" });

    const sequence = await Sequence.create({
      name,
      triggerEvent: triggerEvent || null,
      isActive: true
    });

    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await SequenceStep.create({
          sequenceId: sequence.id,
          order: i + 1,
          delayDays: s.delayDays || 1,
          messageTemplateId: s.messageTemplateId || null
        });
      }
    }

    const fullSequence = await Sequence.findByPk(sequence.id, {
      include: [{ model: SequenceStep, as: "steps" }]
    });

    res.status(201).json(fullSequence);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const enrollInSequence = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, sequenceId } = req.body;
    if (!sequenceId) return res.status(400).json({ error: "sequenceId is required" });

    const sequence = await Sequence.findByPk(sequenceId);
    if (!sequence) return res.status(404).json({ error: "Sequence not found" });

    const enrollment = await SequenceEnrollment.create({
      leadId: leadId || null,
      customerId: customerId || null,
      sequenceId,
      currentStep: 1,
      enrolledAt: new Date(),
      status: "active"
    });

    if (leadId) {
      await Activity.create({
        leadId,
        type: "email",
        outcome: `Enrolled in Drip Sequence: ${sequence.name} (Step 1 scheduled)`,
        createdById: (req as any).user?.id || null
      });
    }

    res.status(201).json({ message: "Successfully enrolled in sequence", enrollment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEnrollments = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;

    const enrollments = await SequenceEnrollment.findAll({
      where,
      include: [{ model: Sequence, as: "sequence" }],
      order: [["enrolledAt", "DESC"]]
    });

    res.json(enrollments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
