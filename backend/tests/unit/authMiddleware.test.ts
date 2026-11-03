import { authMiddleware } from "../../src/middleware/auth";
import jwt from "jsonwebtoken";
import { sequelize } from "@nexus-crm/database";

describe("authMiddleware - Token Security", () => {
  const secret = process.env.JWT_SECRET || "default_secret";
  const validToken = jwt.sign(
    { id: "test-user-uuid", email: "test@nexus.com", role: "admin" },
    secret,
    { expiresIn: "1h" }
  );

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch {}
  });

  it("rejects a request with ?token=<valid jwt> and no Authorization header with 401", () => {
    const req: any = {
      headers: {},
      query: { token: validToken },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized: Missing or invalid token",
    });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("rejects a request with cookie token and no Authorization header with 401", () => {
    const req: any = {
      headers: {
        cookie: `token=${validToken}`,
      },
      cookies: { token: validToken },
      query: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized: Missing or invalid token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a request with valid token in Authorization: Bearer <token>", () => {
    const req: any = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
      query: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe("test-user-uuid");
  });
});
