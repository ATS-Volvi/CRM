import { rejectQuote } from "../../src/controllers/quoteController";
import { sequelize } from "@nexus-crm/database";

describe("Quote Rejection Unit & Authorization Tests", () => {
  it("should return 400 if rejectionReason is missing or empty", async () => {
    const req: any = {
      params: { id: "quote-123" },
      body: { rejectionReason: "   " },
      user: { id: "user-123", role: "SALES_REP" }
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await rejectQuote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Rejection reason is required" })
    );
  });
});
