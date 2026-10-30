import { test, expect } from "@playwright/test";

test.describe.serial("Site Manager & Operations Manager Role Creation and Access Flow", () => {
  const ts = Date.now();
  const adminEmail = process.env.ADMIN_EMAIL || "admin@local.test";
  const adminPassword = process.env.ADMIN_PASSWORD || "TestPassword123!";

  const siteManagerEmail = `sm-e2e-${ts}@nexus.com`;
  const siteManagerPassword = process.env.USER_TEST_PASSWORD || "TestPassword123!";
  const siteManagerName = `Site Manager ${ts}`;

  const opsManagerEmail = `om-e2e-${ts}@nexus.com`;
  const opsManagerPassword = process.env.USER_TEST_PASSWORD || "TestPassword123!";
  const opsManagerName = `Ops Manager ${ts}`;

  test("Gate OFF: Admin registers Site Manager & Ops Manager, verifies landing on /site-inspections", async ({ page }) => {
    // 1. Log in as admin
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard / home
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // 2. Navigate to Business Users
    await page.goto("/salespersons");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Business Users" })).toBeVisible();

    // 3. Open Add New Employee form
    await page.click('button:has-text("Add New Employee")');
    await expect(page.locator('form:has-text("Add New Employee")')).toBeVisible();

    // 4. Fill in form for Site Manager
    await page.fill('input[placeholder="e.g. Jane Smith"]', siteManagerName);
    await page.fill('input[placeholder="e.g. jane@company.com"]', siteManagerEmail);
    await page.fill('input[placeholder="Min. 8 characters"]', siteManagerPassword);

    // Select Role: Site Manager
    const roleSelect = page.locator("form select").filter({ has: page.locator('option[value="site_manager"]') });
    await roleSelect.selectOption("site_manager");

    // Submit form
    await page.click('button:has-text("Register Employee")');

    // Verify form closes (successful registration)
    await expect(page.locator('form:has-text("Add New Employee")')).not.toBeVisible({ timeout: 10000 });

    // 5. Navigate back to /salespersons and open Add New Employee form for Ops Manager
    await page.goto("/salespersons");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Business Users" })).toBeVisible();
    await page.click('button:has-text("Add New Employee")');
    await expect(page.locator('form:has-text("Add New Employee")')).toBeVisible();

    await page.fill('input[placeholder="e.g. Jane Smith"]', opsManagerName);
    await page.fill('input[placeholder="e.g. jane@company.com"]', opsManagerEmail);
    await page.fill('input[placeholder="Min. 8 characters"]', opsManagerPassword);

    // Select Role: Operations Manager
    const opsRoleSelect = page.locator("form select").filter({ has: page.locator('option[value="ops_manager"]') });
    await opsRoleSelect.selectOption("ops_manager");

    // Submit form
    await page.click('button:has-text("Register Employee")');

    // Verify form closes (successful registration)
    await expect(page.locator('form:has-text("Add New Employee")')).not.toBeVisible({ timeout: 10000 });

    // 6. Log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 7. Log in as Site Manager
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', siteManagerEmail);
    await page.fill('input[type="password"]', siteManagerPassword);
    await page.click('button[type="submit"]');

    // Verify landing on /site-inspections
    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 15000 });
    expect(page.url()).toContain("/site-inspections");

    // Attempting to visit /salespersons or /leads must redirect to /site-inspections
    await page.goto("/salespersons");
    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 10000 });
    expect(page.url()).toContain("/site-inspections");

    // 8. Log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 9. Log in as Operations Manager
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', opsManagerEmail);
    await page.fill('input[type="password"]', opsManagerPassword);
    await page.click('button[type="submit"]');

    // Verify landing on /site-inspections
    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 15000 });
    expect(page.url()).toContain("/site-inspections");

    // Attempting to visit /salespersons must redirect to /site-inspections
    await page.goto("/salespersons");
    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 10000 });
    expect(page.url()).toContain("/site-inspections");
  });

  test("Gate ON: Site Manager & Operations Manager access and navigation with gate active", async ({ page }) => {
    // 1. Log in as Site Manager
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', siteManagerEmail);
    await page.fill('input[type="password"]', siteManagerPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 15000 });
    expect(page.url()).toContain("/site-inspections");

    // 2. Log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 3. Log in as Operations Manager
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', opsManagerEmail);
    await page.fill('input[type="password"]', opsManagerPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname.includes("/site-inspections"), { timeout: 15000 });
    expect(page.url()).toContain("/site-inspections");
  });
});
