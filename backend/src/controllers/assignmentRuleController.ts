import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getAssignmentRules = async (req: Request, res: Response) => {
  try {
    const rules = await sequelize.models.AssignmentRule.findAll({
      include: [{ model: sequelize.models.User, as: "assignTo" }],
      order: [['priority', 'ASC']]
    });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
