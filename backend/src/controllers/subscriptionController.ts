import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId as string;
    const { planName, mrr, billingCycle, startDate, status } = req.body;

    const subscription = await sequelize.models.Subscription.create({
      id: require("crypto").randomUUID(),
      accountId,
      planName,
      mrr: mrr ? parseFloat(mrr) : 0,
      billingCycle: billingCycle || "Monthly",
      startDate: startDate ? new Date(startDate) : new Date(),
      status: status || "Active"
    });

    return res.status(201).json(subscription);
  } catch (error: any) {
    console.error("Error creating subscription:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { planName, mrr, billingCycle, startDate, endDate, status } = req.body;

    const subscription = await sequelize.models.Subscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    if (planName) subscription.set('planName', planName);
    if (mrr !== undefined) subscription.set('mrr', parseFloat(mrr));
    if (billingCycle) subscription.set('billingCycle', billingCycle);
    if (startDate) subscription.set('startDate', new Date(startDate));
    if (endDate) subscription.set('endDate', new Date(endDate));
    if (status) subscription.set('status', status);

    await subscription.save();

    return res.status(200).json(subscription);
  } catch (error: any) {
    console.error("Error updating subscription:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
