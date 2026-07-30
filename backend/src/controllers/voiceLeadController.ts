import { Request, Response } from "express";
import { extractLeadDetailsFromText } from "../services/aiLeadExtraction";

export const parseVoiceLead = async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required and must be a string." });
    }

    const extracted = await extractLeadDetailsFromText(transcript);
    return res.json(extracted);

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

