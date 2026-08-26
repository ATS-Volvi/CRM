import { sequelize, Deal, User, Lead } from "@nexus-crm/database";

describe("Opportunity Handoff Chain & Model Close Hook", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("Model Hook: status change to WON automatically sets actualClosedAt timestamp", async () => {
    const testDeal: any = await Deal.create({
      name: "Test Close Hook Deal",
      amount: 100000,
      status: "OPEN"
    });

    expect(testDeal.actualClosedAt).toBeNull();

    await testDeal.update({ status: "WON" });

    expect(testDeal.actualClosedAt).not.toBeNull();
    expect(new Date(testDeal.actualClosedAt).getTime()).toBeGreaterThan(0);

    // Clean up
    await testDeal.destroy({ force: true });
  });

  test("Model Hook: status change back to OPEN clears actualClosedAt timestamp", async () => {
    const testDeal: any = await Deal.create({
      name: "Test Reopen Deal",
      amount: 150000,
      status: "WON"
    });

    expect(testDeal.actualClosedAt).not.toBeNull();

    await testDeal.update({ status: "OPEN" });

    expect(testDeal.actualClosedAt).toBeNull();

    // Clean up
    await testDeal.destroy({ force: true });
  });

  test("Model Hook: status change to LOST automatically sets actualClosedAt timestamp", async () => {
    const testDeal: any = await Deal.create({
      name: "Test Lost Hook Deal",
      amount: 50000,
      status: "OPEN"
    });

    expect(testDeal.actualClosedAt).toBeNull();

    await testDeal.update({ status: "LOST" });

    expect(testDeal.actualClosedAt).not.toBeNull();

    // Clean up
    await testDeal.destroy({ force: true });
  });
});
