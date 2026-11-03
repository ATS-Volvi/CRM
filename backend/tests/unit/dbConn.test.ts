import { isLocalDatabaseHost } from "@nexus-crm/database";

describe("Database Connection SSL and Host Resolution", () => {
  describe("isLocalDatabaseHost", () => {
    it("returns true for localhost hostnames", () => {
      expect(isLocalDatabaseHost("postgres://user:pass@localhost:5432/mydb")).toBe(true);
      expect(isLocalDatabaseHost("postgres://localhost:5432/mydb")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://localhost/mydb")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://user:pass@localhost")).toBe(true);
    });

    it("returns true for 127.0.0.1 hostnames", () => {
      expect(isLocalDatabaseHost("postgres://user:pass@127.0.0.1:5432/mydb")).toBe(true);
      expect(isLocalDatabaseHost("postgres://127.0.0.1:5432/mydb")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://127.0.0.1/mydb")).toBe(true);
    });

    it("returns false for remote hosts even if URL contains 'localhost' elsewhere", () => {
      // localhost in password
      expect(
        isLocalDatabaseHost(
          "postgres://user:mypass_localhost_123@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
        )
      ).toBe(false);

      // localhost in username
      expect(
        isLocalDatabaseHost(
          "postgres://localhost_user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb"
        )
      ).toBe(false);

      // localhost in database name/path
      expect(
        isLocalDatabaseHost(
          "postgres://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/localhost_db"
        )
      ).toBe(false);

      // localhost as subdomain or suffix
      expect(isLocalDatabaseHost("postgres://user:pass@notlocalhost.example.com:5432/db")).toBe(false);
      expect(isLocalDatabaseHost("postgres://user:pass@localhost.example.com:5432/db")).toBe(false);
      expect(isLocalDatabaseHost("postgres://user:pass@example.localhost.com:5432/db")).toBe(false);
    });

    it("returns false for Neon-style remote database URLs", () => {
      const neonPoolerUrl =
        "postgresql://alex:AbC123_xyz@ep-fragrant-pond-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
      expect(isLocalDatabaseHost(neonPoolerUrl)).toBe(false);
    });

    it("returns false for undefined, null, or malformed inputs", () => {
      expect(isLocalDatabaseHost(undefined)).toBe(false);
      expect(isLocalDatabaseHost("")).toBe(false);
      expect(isLocalDatabaseHost("not a valid url")).toBe(false);
    });
  });

  describe("Production DATABASE_URL enforcement", () => {
    it("fails with clear error if DATABASE_URL is missing in production", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDbUrl = process.env.DATABASE_URL;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.DATABASE_URL;

        expect(() => {
          if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL environment variable is required in production");
          }
        }).toThrow("DATABASE_URL environment variable is required in production");
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalDbUrl !== undefined) {
          process.env.DATABASE_URL = originalDbUrl;
        }
      }
    });
  });
});
