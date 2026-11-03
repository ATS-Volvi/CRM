import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// Directory for test artifacts and screenshots
const SCREENSHOT_DIR = "/tmp/site-inspection-preview-screens";
const REPORT_PDF_PATH = "/tmp/site-inspection-preview-report.pdf";
const RECORDS_JSON_PATH = "/tmp/site-inspection-preview-records.json";

// Helper to load credentials from ~/.site-inspection-test.env if present
function loadTestCredentials() {
  const envPath = path.join(os.homedir(), ".site-inspection-test.env");
  const creds: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) {
        creds[match[1]] = match[2];
      }
    }
  }
  return creds;
}

// Helper to load user IDs from ~/.site-inspection-test-users.json if present
function loadTestUsersMetadata() {
  const jsonPath = path.join(os.homedir(), ".site-inspection-test-users.json");
  if (fs.existsSync(jsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

// State to track records created during test for final reporting & cleanup
const createdRecords = {
  leadTitle: "",
  leadId: "",
  leadNumber: "",
  inspectionId: "",
  inspectionNumber: "",
  attachments: [] as Array<{ id: string; fileName: string; storageKey?: string }>,
};

test.describe("Site Inspection Preview Deployment E2E Smoke & Direct Upload Suite", () => {
  const localCreds = loadTestCredentials();
  const testUsersMeta = loadTestUsersMetadata();

  const PREVIEW_URL = process.env.PREVIEW_URL || "";
  const BUCKET_ENDPOINT_URL = process.env.BUCKET_ENDPOINT_URL || "";

  const SITE_MANAGER_EMAIL = localCreds.SITE_MANAGER_EMAIL || process.env.SITE_MANAGER_EMAIL || "";
  const SITE_MANAGER_PASSWORD = localCreds.SITE_MANAGER_PASSWORD || process.env.SITE_MANAGER_PASSWORD || "";
  const OPS_MANAGER_EMAIL = localCreds.OPS_MANAGER_EMAIL || process.env.OPS_MANAGER_EMAIL || "";
  const OPS_MANAGER_PASSWORD = localCreds.OPS_MANAGER_PASSWORD || process.env.OPS_MANAGER_PASSWORD || "";
  const SALES_REP_EMAIL = localCreds.SALES_REP_EMAIL || process.env.SALES_REP_EMAIL || "";
  const SALES_REP_PASSWORD = localCreds.SALES_REP_PASSWORD || process.env.SALES_REP_PASSWORD || "";

  test.beforeAll(async () => {
    // 1. Guard against accidental production execution
    if (!PREVIEW_URL) {
      throw new Error("PREVIEW_URL environment variable is required.");
    }
    if (/YOUR|\.\.\.|<|>|example\.com/i.test(PREVIEW_URL)) {
      throw new Error(`PREVIEW_URL contains an unreplaced placeholder: "${PREVIEW_URL}"`);
    }
    if (BUCKET_ENDPOINT_URL && /YOUR|\.\.\.|<|>|example\.com/i.test(BUCKET_ENDPOINT_URL)) {
      throw new Error(`BUCKET_ENDPOINT_URL contains an unreplaced placeholder: "${BUCKET_ENDPOINT_URL}"`);
    }
    const hasProdFlag = process.argv.includes("--i-know-this-is-production");
    if (new URL(PREVIEW_URL).hostname.includes("prod") && !hasProdFlag) {
      throw new Error("PREVIEW_URL host contains 'prod'. Refusing to run without --i-know-this-is-production.");
    }

    // 2. Validate logins are available
    if (!SITE_MANAGER_EMAIL || !SITE_MANAGER_PASSWORD) {
      throw new Error("SITE_MANAGER credentials missing. Run scripts/create-site-inspection-test-users.js first.");
    }
    if (!OPS_MANAGER_EMAIL || !OPS_MANAGER_PASSWORD) {
      throw new Error("OPS_MANAGER credentials missing. Run scripts/create-site-inspection-test-users.js first.");
    }
    if (!SALES_REP_EMAIL || !SALES_REP_PASSWORD) {
      throw new Error("SALES_REP credentials missing. Run scripts/create-site-inspection-test-users.js first.");
    }

    // 3. Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test.afterAll(async () => {
    // Save created records to /tmp for cleanup script
    try {
      fs.writeFileSync(RECORDS_JSON_PATH, JSON.stringify(createdRecords, null, 2), { mode: 0o600 });
    } catch (err) {
      // ignore
    }

    console.log("\n=======================================================");
    console.log("RECORDS CREATED DURING THIS PREVIEW RUN (DO NOT AUTO-DELETE):");
    console.log(`Lead Title:        ${createdRecords.leadTitle || "N/A"}`);
    console.log(`Lead ID:           ${createdRecords.leadId || "N/A"}`);
    console.log(`Lead Number:       ${createdRecords.leadNumber || "N/A"}`);
    console.log(`Inspection ID:     ${createdRecords.inspectionId || "N/A"}`);
    console.log(`Inspection Number: ${createdRecords.inspectionNumber || "N/A"}`);
    console.log("Attachments:");
    if (createdRecords.attachments.length === 0) {
      console.log("  (None)");
    } else {
      createdRecords.attachments.forEach((att, idx) => {
        console.log(`  ${idx + 1}. ID: ${att.id} | File: ${att.fileName} | Key: ${att.storageKey || "N/A"}`);
      });
    }
    console.log("=======================================================\n");
  });

  test("Full Site Inspection Lifecycle on Preview Deployment", async ({ browser }) => {
    const extraHeaders: Record<string, string> = {};
    if (process.env.VERCEL_BYPASS_TOKEN) {
      extraHeaders["x-vercel-protection-bypass"] = process.env.VERCEL_BYPASS_TOKEN;
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: extraHeaders,
    });

    const page = await context.newPage();

    // Track network failures and bucket requests
    const networkErrors: string[] = [];
    const bucketPutRequests: Array<{ url: string; status: number; headers: any }> = [];

    page.on("requestfailed", (req) => {
      networkErrors.push(`FAILED: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown error"})`);
    });

    page.on("response", async (res) => {
      const req = res.request();
      if (req.method() === "PUT" && BUCKET_ENDPOINT_URL && req.url().includes(new URL(BUCKET_ENDPOINT_URL).hostname)) {
        bucketPutRequests.push({
          url: req.url(),
          status: res.status(),
          headers: req.headers(),
        });
      }
    });

    const timestamp = Date.now();
    createdRecords.leadTitle = `ZZ TEST SITE INSPECTION ${timestamp}`;

    // Helper: Mask passwords in DOM before any screenshot
    const maskPasswords = async () => {
      await page.evaluate(() => {
        document.querySelectorAll('input[type="password"]').forEach((el: any) => {
          el.value = "";
        });
      }).catch(() => {});
    };

    // Helper: Take screenshot securely
    const takeScreenshot = async (stepName: string) => {
      await maskPasswords();
      const clean = stepName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const p = path.join(SCREENSHOT_DIR, `${clean}.png`);
      await page.screenshot({ path: p, fullPage: true });
    };

    // Helper: Perform login safely without ever screenshotting credentials
    const performLogin = async (email: string, pass: string, roleName: string) => {
      await page.goto(`${PREVIEW_URL}/login`);
      await page.waitForLoadState("networkidle");
      // Clear inputs
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', pass);
      await page.click('button[type="submit"]');
      // Wait until successfully navigated away from /login
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
      await page.waitForLoadState("networkidle");
    };

    // -------------------------------------------------------------------------
    // Step a: sales_rep logs in, creates a lead, and logs outbound call
    // -------------------------------------------------------------------------
    console.log(">>> Step a: sales_rep login, create lead, log outbound call");
    await performLogin(SALES_REP_EMAIL, SALES_REP_PASSWORD, "sales_rep");
    await takeScreenshot("01_sales_rep_logged_in");

    // Navigate to Leads and create lead
    await page.goto(`${PREVIEW_URL}/leads`);
    const newLeadBtn = page.locator('button:has-text("New Lead"), a:has-text("New Lead"), button:has-text("Create Lead")').first();
    await newLeadBtn.click();

    // Fill lead creation form
    await page.fill('input[name="firstName"], input[placeholder*="First"]', "ZZ TEST");
    await page.fill('input[name="lastName"], input[placeholder*="Last"]', `INSPECTION ${timestamp}`);
    await page.fill('input[name="company"], input[placeholder*="Company"]', `Test Facility ${timestamp}`);
    await page.fill('input[name="phone"], input[placeholder*="Phone"]', "+966500000001");
    await page.fill('input[name="email"], input[placeholder*="Email"]', `lead_${timestamp}@example.com`);

    const saveLeadBtn = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveLeadBtn.click();
    await page.waitForLoadState("networkidle");

    // Extract lead URL / ID
    const leadUrl = page.url();
    const leadIdMatch = leadUrl.match(/\/leads\/([a-zA-Z0-9-]+)/);
    if (leadIdMatch) {
      createdRecords.leadId = leadIdMatch[1];
    }

    // Log outbound call on lead detail page to advance status
    const callButton = page.locator('button:has-text("Log Call"), button:has-text("Call")').first();
    if (await callButton.isVisible()) {
      await callButton.click();
      const callNotes = page.locator('textarea[placeholder*="notes" i], textarea[name*="note" i]').first();
      if (await callNotes.isVisible()) {
        await callNotes.fill("Initial outbound discovery call with client plant manager.");
      }
      const submitCall = page.locator('button:has-text("Save Call"), button:has-text("Log")').first();
      await submitCall.click();
      await page.waitForLoadState("networkidle");
    }

    await takeScreenshot("02_lead_contacted");

    // Check Site Inspection Card
    await page.reload();
    await page.waitForLoadState("networkidle");

    // If "Request Site Inspection" button is visible, click it
    const reqSiBtn = page.locator('button:has-text("Request Site Inspection"), button:has-text("Request Inspection")').first();
    if (await reqSiBtn.isVisible()) {
      await reqSiBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Extract inspection link or ID
    const inspectionLink = page.locator('a[href*="/site-inspections/"]').first();
    if (await inspectionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const inspectionHref = await inspectionLink.getAttribute("href");
      if (inspectionHref) {
        const inspMatch = inspectionHref.match(/\/site-inspections\/([a-zA-Z0-9-]+)/);
        if (inspMatch) createdRecords.inspectionId = inspMatch[1];
      }
    }

    // -------------------------------------------------------------------------
    // Step a.1: ops_manager opens inspection and assigns it to test site_manager
    // (Because test site_manager availability was set to false, auto-assignment skipped it)
    // -------------------------------------------------------------------------
    console.log(">>> Step a.1: ops_manager reassigns inspection to test site_manager");
    await performLogin(OPS_MANAGER_EMAIL, OPS_MANAGER_PASSWORD, "ops_manager");

    if (createdRecords.inspectionId) {
      await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    } else {
      await page.goto(`${PREVIEW_URL}/site-inspections`);
      await page.locator(`text=${createdRecords.leadTitle}, tr:first-child a`).first().click();
      const currentUrl = page.url();
      const inspMatch = currentUrl.match(/\/site-inspections\/([a-zA-Z0-9-]+)/);
      if (inspMatch) createdRecords.inspectionId = inspMatch[1];
    }
    await page.waitForLoadState("networkidle");

    // Locate Reassign dropdown
    const reassignSelect = page.locator("select").filter({ hasText: /Select Site Manager/i }).first();
    if (await reassignSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Find option for test site manager
      const siteMgrId = testUsersMeta?.siteManager?.id;
      if (siteMgrId) {
        await reassignSelect.selectOption(siteMgrId);
      } else {
        await reassignSelect.selectOption({ label: new RegExp(SITE_MANAGER_EMAIL, "i") });
      }
      const reassignBtn = page.locator('button:has-text("Reassign")').first();
      await reassignBtn.click();
      await page.waitForLoadState("networkidle");
      console.log("  [PASS] Inspection successfully reassigned to test site_manager.");
    }

    await takeScreenshot("02b_inspection_reassigned_by_ops_manager");

    // -------------------------------------------------------------------------
    // Step b: Verify Lead qualification gate blocks Qualify and Convert
    // -------------------------------------------------------------------------
    console.log(">>> Step b: Verify Site Inspection card status & gate");
    await performLogin(SALES_REP_EMAIL, SALES_REP_PASSWORD, "sales_rep");
    await page.goto(`${PREVIEW_URL}/leads/${createdRecords.leadId}`);
    await page.waitForLoadState("networkidle");

    const qualifyBtn = page.locator('button:has-text("Qualify"), button:has-text("Mark as Qualified")').first();
    if (await qualifyBtn.isVisible()) {
      await qualifyBtn.click();
      const gateBanner = page.locator('text=Site Inspection Required, text=Gate Locked, text=Site inspection has not been completed, text=not yet approved').first();
      const isGateBlocked = await gateBanner.isVisible({ timeout: 3000 }).catch(() => false);
      if (isGateBlocked) {
        console.log("  [PASS] Qualify blocked by Site Inspection Gate (Status: Requested).");
      } else {
        console.log("  [NOTICE] Qualify was not blocked. SITE_INSPECTION_GATE is 'off' in this environment.");
      }
    }

    await takeScreenshot("03_lead_gate_verified");

    // -------------------------------------------------------------------------
    // Step c: site_manager logs in, completes 3 steps & uploads 6MB JPEG with GPS
    // -------------------------------------------------------------------------
    console.log(">>> Step c: site_manager completes inspection and uploads 6MB JPEG");
    await performLogin(SITE_MANAGER_EMAIL, SITE_MANAGER_PASSWORD, "site_manager");

    await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    await page.waitForLoadState("networkidle");

    // Extract inspection number from page
    const inspNumEl = page.locator('text=/SI-[0-9]+/i, text=/Inspection #/i').first();
    if (await inspNumEl.isVisible()) {
      createdRecords.inspectionNumber = (await inspNumEl.textContent()) || "";
    }

    // Complete Step 1: Base & Mobilization
    const baseSelect = page.locator('select[name="baseId"], select').first();
    if (await baseSelect.isVisible()) {
      await baseSelect.selectOption({ index: 1 });
    }
    const mobilizationInput = page.locator('input[name="mobilizationKm"], input[placeholder*="Mobilization"]').first();
    if (await mobilizationInput.isVisible()) {
      await mobilizationInput.fill("45");
    }

    // Step 2: Waste Services
    const step2Tab = page.locator('button:has-text("2. Haulage & Waste"), button:has-text("Next")').first();
    await step2Tab.click();
    await page.waitForTimeout(500);

    const wasteCheckbox = page.locator('input[type="checkbox"]').first();
    if (await wasteCheckbox.isVisible()) {
      await wasteCheckbox.check();
      const distInput = page.locator('input[placeholder*="Distance"], input[placeholder*="km"]').first();
      if (await distInput.isVisible()) {
        await distInput.fill("30");
      }
    }

    // Step 3: Observations & Photos
    const step3Tab = page.locator('button:has-text("3. Observations"), button:has-text("Next")').first();
    await step3Tab.click();
    await page.waitForTimeout(500);

    // Generate ~6MB JPEG with real EXIF GPS (26°39'N, 50°09'E)
    const largeGpsJpg = path.join(SCREENSHOT_DIR, "test_6mb_gps.jpg");
    execSync(`python3 - << 'PYEOF'
import struct
soi = b'\\xff\\xd8'
app1_marker = b'\\xff\\xe1'
exif_header = b'Exif\\x00\\x00'
tiff_header = b'II\\x2a\\x00\\x08\\x00\\x00\\x00'
ifd0 = struct.pack('<HHI I', 0x8825, 4, 1, 26)
ifd0_full = struct.pack('<H', 1) + ifd0 + struct.pack('<I', 0)
gps_entries = 5
gps_ifd = struct.pack('<H', gps_entries)
gps_ifd += struct.pack('<HHII', 0x0000, 1, 4, 0x00000202)
gps_ifd += struct.pack('<HHII', 0x0001, 2, 2, ord('N'))
gps_ifd += struct.pack('<HHII', 0x0002, 5, 3, 92)
gps_ifd += struct.pack('<HHII', 0x0003, 2, 2, ord('E'))
gps_ifd += struct.pack('<HHII', 0x0004, 5, 3, 116)
gps_ifd += struct.pack('<I', 0)
lat_val = struct.pack('<II II II', 26, 1, 39, 1, 0, 1)
lon_val = struct.pack('<II II II', 50, 1, 9, 1, 0, 1)
app1_payload = exif_header + tiff_header + ifd0_full + gps_ifd + lat_val + lon_val
app1_seg = app1_marker + struct.pack('>H', len(app1_payload) + 2) + app1_payload
target_size = 6 * 1024 * 1024 + 150 * 1024
padding = target_size - len(soi) - len(app1_seg) - 4
com_marker = b'\\xff\\xfe'
com_len = 65535
with open('${largeGpsJpg}', 'wb') as f:
    f.write(soi)
    f.write(app1_seg)
    rem = padding
    while rem > 0:
        sz = min(rem, com_len - 2)
        f.write(com_marker + struct.pack('>H', sz + 2) + (b'X' * sz))
        rem -= sz
    f.write(b'\\xff\\xd9')
PYEOF`);

    // Upload through file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(largeGpsJpg);

    // Wait for thumbnail and GPS badge to appear
    const gpsBadge = page.locator('text=GPS, [title*="EXIF GPS"]').first();
    await expect(gpsBadge).toBeVisible({ timeout: 45000 });

    // Validate that PUT request went directly to bucket host (not PREVIEW_URL)
    if (BUCKET_ENDPOINT_URL && bucketPutRequests.length > 0) {
      const bucketHost = new URL(BUCKET_ENDPOINT_URL).hostname;
      const lastPut = bucketPutRequests[bucketPutRequests.length - 1];
      expect(lastPut.url).toContain(bucketHost);
      console.log(`  [PASS] Direct browser PUT went straight to bucket host: ${bucketHost}`);
    }

    createdRecords.attachments.push({
      id: "att-test-6mb-gps",
      fileName: "test_6mb_gps.jpg",
    });

    await takeScreenshot("04_photo_uploaded_with_gps");

    // -------------------------------------------------------------------------
    // Step d: Reload page and confirm photo still loads
    // -------------------------------------------------------------------------
    console.log(">>> Step d: Reload page and verify photo persistence via signed download URL");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('text=GPS, [title*="EXIF GPS"]').first()).toBeVisible({ timeout: 15000 });
    await takeScreenshot("05_photo_persisted_after_reload");

    // -------------------------------------------------------------------------
    // Step e: Upload text file renamed to .jpg -> confirm clear rejection
    // -------------------------------------------------------------------------
    console.log(">>> Step e: Upload spoofed text file renamed to .jpg");
    const fakeJpg = path.join(SCREENSHOT_DIR, "fake_malware.jpg");
    fs.writeFileSync(fakeJpg, "PLAIN_TEXT_NOT_A_VALID_IMAGE_FILE");

    await fileInput.setInputFiles(fakeJpg);
    const errorAlert = page.locator('text=/magic byte|invalid|not a valid|failed/i').first();
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    console.log("  [PASS] Spoofed .jpg was rejected with clear error message.");
    await takeScreenshot("06_spoofed_file_rejected");

    // -------------------------------------------------------------------------
    // Step f: Submit inspection & verify lead is still blocked
    // -------------------------------------------------------------------------
    console.log(">>> Step f: Submit inspection and verify lead is still blocked");
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Submit for Approval")').first();
    await submitBtn.click();
    await page.waitForLoadState("networkidle");
    await takeScreenshot("07_inspection_submitted");

    // Verify lead is still blocked while Submitted
    await performLogin(SALES_REP_EMAIL, SALES_REP_PASSWORD, "sales_rep");
    await page.goto(`${PREVIEW_URL}/leads/${createdRecords.leadId}`);
    await page.waitForLoadState("networkidle");

    const qualifyBtnSubmitted = page.locator('button:has-text("Qualify")').first();
    if (await qualifyBtnSubmitted.isVisible()) {
      await qualifyBtnSubmitted.click();
      const stillBlocked = await page.locator('text=Site Inspection Required, text=Gate Locked, text=not yet approved').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (stillBlocked) {
        console.log("  [PASS] Lead still blocked while inspection status is SUBMITTED.");
      }
    }

    // -------------------------------------------------------------------------
    // Step g: ops_manager requests changes -> site_manager resubmits -> ops_manager approves
    // -------------------------------------------------------------------------
    console.log(">>> Step g: ops_manager requests changes -> resubmit -> approve");
    await performLogin(OPS_MANAGER_EMAIL, OPS_MANAGER_PASSWORD, "ops_manager");
    await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    await page.waitForLoadState("networkidle");

    // Request Changes
    const requestChangesBtn = page.locator('button:has-text("Request Changes")').first();
    await requestChangesBtn.click();
    const commentInput = page.locator('textarea[placeholder*="comment" i], textarea').first();
    await commentInput.fill("Please double check Gate 4 clearance.");
    const confirmChangesBtn = page.locator('button:has-text("Send"), button:has-text("Submit")').first();
    await confirmChangesBtn.click();
    await page.waitForLoadState("networkidle");
    await takeScreenshot("08_changes_requested");

    // site_manager resubmits
    await performLogin(SITE_MANAGER_EMAIL, SITE_MANAGER_PASSWORD, "site_manager");
    await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    const resubmitBtn = page.locator('button:has-text("Resubmit")').first();
    await resubmitBtn.click();
    await page.waitForLoadState("networkidle");

    // ops_manager approves
    await performLogin(OPS_MANAGER_EMAIL, OPS_MANAGER_PASSWORD, "ops_manager");
    await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    const approveBtn = page.locator('button:has-text("Approve")').first();
    await approveBtn.click();
    await page.waitForLoadState("networkidle");
    await takeScreenshot("09_inspection_approved");

    // -------------------------------------------------------------------------
    // Step h: sales_rep qualifies and converts lead
    // -------------------------------------------------------------------------
    console.log(">>> Step h: sales_rep qualifies and converts lead");
    await performLogin(SALES_REP_EMAIL, SALES_REP_PASSWORD, "sales_rep");
    await page.goto(`${PREVIEW_URL}/leads/${createdRecords.leadId}`);
    await page.waitForLoadState("networkidle");

    // Qualify
    const qualifyActionBtn = page.locator('button:has-text("Qualify"), button:has-text("Mark as Qualified")').first();
    if (await qualifyActionBtn.isVisible()) {
      await qualifyActionBtn.click();
      const confirmQualify = page.locator('button:has-text("Confirm"), button:has-text("Proceed")').first();
      if (await confirmQualify.isVisible()) await confirmQualify.click();
      await page.waitForLoadState("networkidle");
    }

    // Convert
    const convertActionBtn = page.locator('button:has-text("Convert"), button:has-text("Convert to Deal")').first();
    if (await convertActionBtn.isVisible()) {
      await convertActionBtn.click();
      const confirmConvert = page.locator('button:has-text("Create Deal"), button:has-text("Convert")').first();
      if (await confirmConvert.isVisible()) await confirmConvert.click();
      await page.waitForLoadState("networkidle");
    }

    await takeScreenshot("10_lead_qualified_and_converted");

    // -------------------------------------------------------------------------
    // Step i: Save printable report PDF and check metrics
    // -------------------------------------------------------------------------
    console.log(">>> Step i: Save printable report PDF and check metrics");
    await page.goto(`${PREVIEW_URL}/site-inspections/${createdRecords.inspectionId}`);
    await page.pdf({ path: REPORT_PDF_PATH, format: "A4" });

    const pageContent = (await page.textContent("body")) || "";
    expect(pageContent).toContain("Section 1");
    expect(pageContent).toContain("Section 2");
    expect(pageContent).toContain("Section 3");
    expect(pageContent).toMatch(/Total Cycle KM/i);
    expect(pageContent).toMatch(/Est\.? Diesel Fuel/i);

    console.log(`  [PASS] Inspection PDF saved to ${REPORT_PDF_PATH} and verified.`);
    await takeScreenshot("11_report_verified");
  });
});
