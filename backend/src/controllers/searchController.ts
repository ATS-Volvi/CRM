import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({ leads: [], customers: [], deals: [], quotes: [], tasks: [] });
    }

    const likeQuery = `%${q}%`;

    const [leads, customers, deals, quotes, tasks] = await Promise.all([
      sequelize.models.Lead.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.like]: likeQuery } },
            { lastName: { [Op.like]: likeQuery } },
            { company: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "firstName", "lastName", "company", "email", "status"]
      }),
      sequelize.models.Customer.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } },
            { primaryContactName: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "name", "email", "primaryContactName"]
      }),
      sequelize.models.Deal.findAll({
        where: {
          title: { [Op.like]: likeQuery }
        },
        limit: 5,
        attributes: ["id", "title", "amount", "stage"]
      }),
      sequelize.models.Quote.findAll({
        where: {
          quoteNumber: { [Op.like]: likeQuery }
        },
        limit: 5,
        attributes: ["id", "quoteNumber", "totalAmount", "status"]
      }),
      sequelize.models.Task.findAll({
        where: {
          title: { [Op.like]: likeQuery }
        },
        limit: 5,
        attributes: ["id", "title", "priority", "status"]
      })
    ]);

    res.json({ leads, customers, deals, quotes, tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
