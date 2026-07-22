import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({
        leads: [], customers: [], deals: [], quotes: [], tasks: [],
        meetings: [], salespersons: [], calls: []
      });
    }

    const likeQuery = `%${q}%`;

    const [leads, customers, deals, quotes, tasks, meetings, salespersons, calls] = await Promise.all([
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
            { primaryContactName: { [Op.like]: likeQuery } },
            { industry: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "name", "email", "primaryContactName", "industry", "phone"]
      }),
      sequelize.models.Deal.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "name", "amount", "stageId"]
      }),
      sequelize.models.Quote.findAll({
        where: {
          [Op.or]: [
            { quoteNumber: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "quoteNumber", "totalAmount", "status"]
      }),
      sequelize.models.Task.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "title", "priority", "dueDate"]
      }),
      sequelize.models.Meeting ? sequelize.models.Meeting.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5
      }).catch(() => []) : Promise.resolve([]),
      sequelize.models.User.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: likeQuery } },
            { email: { [Op.like]: likeQuery } },
            { department: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5,
        attributes: ["id", "name", "email", "role", "department", "territory"]
      }),
      sequelize.models.CallLog ? sequelize.models.CallLog.findAll({
        where: {
          [Op.or]: [
            { subject: { [Op.like]: likeQuery } },
            { notes: { [Op.like]: likeQuery } }
          ]
        },
        limit: 5
      }).catch(() => []) : Promise.resolve([])
    ]);

    res.json({ leads, customers, deals, quotes, tasks, meetings, salespersons, calls });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
