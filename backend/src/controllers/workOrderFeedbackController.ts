import { Request, Response } from "express";
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";
import { Op } from "sequelize";
import {
  WorkOrderFeedback,
  WorkOrder,
  ServiceResource,
  ServiceAppointment,
  User,
} from "@nexus-crm/database";
import { createNotification } from "../services/notificationEngine";
import { verifyFeedbackToken } from "../services/workOrderNotificationService";

/**
 * GET /api/v1/public/feedback/:token
 * Strictly read-only verification of the feedback token.
 * Does NOT record any rating or submission.
 */
export const getPublicFeedbackByToken = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || "");
    if (!token) {
      return res.status(404).json({ error: "Feedback token is required" });
    }

    const verified = verifyFeedbackToken(token);
    let feedback: any = null;
    if (verified) {
      feedback = await WorkOrderFeedback.findOne({
        where: { id: verified.feedbackId, tokenVersion: verified.version },
        include: [
          { model: WorkOrder, as: "workOrder" },
          { model: ServiceResource, as: "serviceResource" },
          { model: ServiceAppointment, as: "appointment" },
        ],
      });
    } else {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      feedback = await WorkOrderFeedback.findOne({
        where: { tokenHash },
        include: [
          { model: WorkOrder, as: "workOrder" },
          { model: ServiceResource, as: "serviceResource" },
          { model: ServiceAppointment, as: "appointment" },
        ],
      });
    }

    if (!feedback) {
      return res.status(404).json({ error: "Invalid feedback link. Record not found." });
    }

    const now = new Date();
    if (feedback.tokenExpiresAt && new Date(feedback.tokenExpiresAt) < now) {
      return res.status(410).json({
        error: "This feedback link has expired.",
        expired: true,
        tokenExpiresAt: feedback.tokenExpiresAt,
      });
    }

    const rawRating = req.query.rating ? parseInt(String(req.query.rating), 10) : null;
    const preselectedRating = rawRating && rawRating >= 1 && rawRating <= 5 ? rawRating : feedback.rating || 5;

    const wo = (feedback as any).workOrder;
    const sr = (feedback as any).serviceResource;
    const sa = (feedback as any).appointment;

    const technicianFirstName = sr?.name ? String(sr.name).trim().split(/\s+/)[0] : null;

    let visitDate: string | null = null;
    const rawDate = sa?.actualStartTime || sa?.schedStartTime || feedback.createdAt;
    if (rawDate) {
      try {
        visitDate = new Intl.DateTimeFormat("en-US", {
          timeZone: process.env.COMPANY_TIMEZONE || "Asia/Kolkata",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(rawDate));
      } catch {
        visitDate = new Date(rawDate).toISOString().split("T")[0];
      }
    }

    // Expose ONLY: workOrderNumber, visitDate, technicianFirstName, and rating state.
    // Strictly omit: customer phone/email/address, internal IDs, technician phone/email.
    return res.status(200).json({
      workOrderNumber: wo?.workOrderNumber || "WO-" + String(feedback.workOrderId || "").slice(0, 6),
      visitDate,
      technicianFirstName,
      rating: feedback.rating,
      comment: feedback.comment || null,
      preselectedRating,
      isAlreadySubmitted: Boolean(feedback.submittedAt),
      submittedAt: feedback.submittedAt,
    });
  } catch (error: any) {
    console.error("[WorkOrderFeedback] Error retrieving feedback token:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
};

/**
 * POST /api/v1/public/feedback/:token
 * Submits rating and optional comment once.
 * Rejects repeat submissions and expired tokens.
 */
export const submitPublicFeedbackByToken = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || "");
    if (!token) {
      return res.status(404).json({ error: "Feedback token is required" });
    }

    const verified = verifyFeedbackToken(token);
    let feedback: any = null;
    if (verified) {
      feedback = await WorkOrderFeedback.findOne({
        where: { id: verified.feedbackId, tokenVersion: verified.version },
        include: [
          { model: WorkOrder, as: "workOrder" },
          { model: ServiceResource, as: "serviceResource" },
        ],
      });
    } else {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      feedback = await WorkOrderFeedback.findOne({
        where: { tokenHash },
        include: [
          { model: WorkOrder, as: "workOrder" },
          { model: ServiceResource, as: "serviceResource" },
        ],
      });
    }

    if (!feedback) {
      return res.status(404).json({ error: "Invalid feedback link. Record not found." });
    }

    const now = new Date();
    if (feedback.tokenExpiresAt && new Date(feedback.tokenExpiresAt) < now) {
      return res.status(410).json({
        error: "This feedback link has expired.",
        expired: true,
      });
    }

    if (feedback.submittedAt) {
      return res.status(400).json({
        error: "Feedback has already been submitted for this service appointment.",
        alreadySubmitted: true,
        submittedAt: feedback.submittedAt,
        rating: feedback.rating,
      });
    }

    const { rating, comment } = req.body || {};
    const parsedRating = parseInt(String(rating), 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    // Sanitize and limit comment to 2000 characters
    let cleanComment = "";
    if (comment && typeof comment === "string") {
      cleanComment = sanitizeHtml(comment.trim(), {
        allowedTags: [],
        allowedAttributes: {},
      }).slice(0, 2000);
    }

    feedback.rating = parsedRating;
    feedback.comment = cleanComment || null;
    feedback.submittedAt = now;
    await feedback.save();

    // Low rating alert (rating <= 2) to work order owner and manager
    if (parsedRating <= 2) {
      try {
        const wo = (feedback as any).workOrder;
        const managers = await User.findAll({
          where: {
            role: { [Op.in]: ["manager", "admin", "sales_manager", "director"] },
          },
        });

        const alertUserIds = new Set<string>();
        if (wo?.ownerId) alertUserIds.add(wo.ownerId);
        for (const m of managers) alertUserIds.add(m.id);

        for (const userId of alertUserIds) {
          await createNotification({
            userId,
            type: "LOW_FEEDBACK_RATING",
            severity: "WARNING",
            title: `Low Customer Rating (${parsedRating}/5) on Work Order #${wo?.workOrderNumber || wo?.id}`,
            message: `Customer rated service ${parsedRating}/5${cleanComment ? `: "${cleanComment}"` : "."}`,
            entityType: "SYSTEM",
            entityId: wo?.id,
          });
        }
      } catch (alertErr) {
        console.warn("[WorkOrderFeedback] Error dispatching low rating alert:", alertErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Thank you for your feedback!",
      rating: parsedRating,
      comment: feedback.comment,
      submittedAt: feedback.submittedAt,
    });
  } catch (error: any) {
    console.error("[WorkOrderFeedback] Error submitting feedback:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
};
