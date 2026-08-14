import { Request, Response } from "express";
import { Account, Contact, Deal, DealContact } from "@nexus-crm/database";

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await Account.findAll({
      include: [
        { model: Contact, as: "contacts" },
        { model: Deal, as: "deals" }
      ],
      order: [["createdAt", "DESC"]]
    });
    return res.status(200).json(accounts);
  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id, {
      include: [
        { model: Contact, as: "contacts" },
        { 
          model: Deal, 
          as: "deals"
        }
      ]
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    return res.status(200).json(account);
  } catch (error: any) {
    console.error("Error fetching account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
