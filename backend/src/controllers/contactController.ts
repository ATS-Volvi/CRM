import { Request, Response } from "express";
import { Contact, Account, Deal, DealContact } from "@nexus-crm/database";

export const getContacts = async (req: Request, res: Response) => {
  try {
    const contacts = await Contact.findAll({
      include: [
        { model: Account, as: "account" },
        { 
          model: Deal, 
          as: "deals",
          through: { attributes: ['role', 'isPrimary'] }
        }
      ],
      order: [["createdAt", "DESC"]]
    });
    return res.status(200).json(contacts);
  } catch (error: any) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getContactById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const contact = await Contact.findByPk(id, {
      include: [
        { model: Account, as: "account" },
        { 
          model: Deal, 
          as: "deals",
          through: { attributes: ['role', 'isPrimary'] }
        }
      ]
    });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    return res.status(200).json(contact);
  } catch (error: any) {
    console.error("Error fetching contact:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
