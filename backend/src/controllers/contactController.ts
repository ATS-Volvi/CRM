import { Request, Response } from "express";
import { Contact, Account, Deal, DealContact } from "@nexus-crm/database";
import crypto from "crypto";

export const getContacts = async (req: Request, res: Response) => {
  try {
    const contacts = await Contact.findAll({
      include: [
        { model: Account, as: "account" },
        { 
          model: Deal, 
          as: "contactDeals",
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
          as: "contactDeals",
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

/**
 * POST /api/v1/contacts
 * Create a new Contact, optionally linking to a Deal via DealContact.
 */
export const createContact = async (req: Request, res: Response) => {
  try {
    const { accountId, firstName, lastName, email, phone, role, sourceChannel, dealId, dealRole, isPrimary } = req.body;

    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    const account = await Account.findByPk(accountId);
    if (!account) {
      return res.status(400).json({ message: "Account not found" });
    }

    // Prevent duplicate contacts by email
    if (email) {
      const existing = await Contact.findOne({ where: { email } });
      if (existing) {
        return res.status(409).json({ message: "A contact with this email already exists", contact: existing });
      }
    }

    const contact = await Contact.create({
      id: crypto.randomUUID(),
      accountId,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      role: role || "Contact",
      sourceChannel: sourceChannel || null
    });

    // Optionally link to a Deal
    if (dealId) {
      const deal = await Deal.findByPk(dealId);
      if (deal) {
        await DealContact.create({
          id: crypto.randomUUID(),
          dealId,
          contactId: (contact as any).id,
          role: dealRole || role || "Contact",
          isPrimary: isPrimary === true
        });
      }
    }

    const populated = await Contact.findByPk((contact as any).id, {
      include: [{ model: Account, as: "account" }]
    });

    return res.status(201).json(populated);
  } catch (error: any) {
    console.error("Error creating contact:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * PUT /api/v1/contacts/:id
 * Update an existing Contact record.
 */
export const updateContact = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const contact = await Contact.findByPk(id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const { firstName, lastName, email, phone, role, sourceChannel, accountId } = req.body;

    // Validate accountId if being changed
    if (accountId && accountId !== (contact as any).accountId) {
      const account = await Account.findByPk(accountId);
      if (!account) {
        return res.status(400).json({ message: "Account not found" });
      }
    }

    // Prevent duplicate email collisions
    if (email && email !== (contact as any).email) {
      const existing = await Contact.findOne({ where: { email } });
      if (existing && (existing as any).id !== id) {
        return res.status(409).json({ message: "A contact with this email already exists" });
      }
    }

    await contact.update({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(role !== undefined && { role }),
      ...(sourceChannel !== undefined && { sourceChannel }),
      ...(accountId !== undefined && { accountId })
    });

    const populated = await Contact.findByPk(id, {
      include: [{ model: Account, as: "account" }]
    });

    return res.status(200).json(populated);
  } catch (error: any) {
    console.error("Error updating contact:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
