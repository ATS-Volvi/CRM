import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Helper to load bucket config without logging or printing
function loadBucketEnv() {
  const envPath = path.join(os.homedir(), ".site-inspection-bucket.env");
  if (!fs.existsSync(envPath)) {
    throw new Error("~/.site-inspection-bucket.env not found");
  }
  const content = fs.readFileSync(envPath, "utf8");
  const parsed: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      parsed[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
  return parsed;
}

test.describe("Neon Object Storage S3 Integration E2E Flow", () => {
  const bucketEnv = loadBucketEnv();
  const bucketName = bucketEnv.S3_BUCKET || "nexus-crm-inspections";
  const s3Client = new S3Client({
    region: bucketEnv.S3_REGION || "us-east-1",
    endpoint: bucketEnv.S3_ENDPOINT,
    forcePathStyle: bucketEnv.S3_FORCE_PATH_STYLE === "true" || bucketEnv.S3_FORCE_PATH_STYLE === "1",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: bucketEnv.S3_ACCESS_KEY_ID || "",
      secretAccessKey: bucketEnv.S3_SECRET_ACCESS_KEY || "",
    },
  });

  const testDir = "/tmp/neon-storage-e2e-fixtures";
  const largeGpsJpg = path.join(testDir, "test_6mb_gps.jpg");
  const fakeJpg = path.join(testDir, "fake_text_spoofed.jpg");
  const inspectionId = "00000000-0000-0000-0000-000000000020";

  const trackedStorageKeys: string[] = [];

  test.beforeAll(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 1. Generate ~6 MB fully decodeable JPEG with valid GPS EXIF (26.65° N, 50.15° E)
    execSync(`python3 - << 'PYEOF'
from PIL import Image
import struct, os

img = Image.new("RGB", (200, 200), color=(60, 120, 200))
img.save("/tmp/base.jpg", "JPEG", quality=90)
with open("/tmp/base.jpg", "rb") as f:
    base_bytes = f.read()

soi = base_bytes[:2]
rest = base_bytes[2:]

exif_header = b"Exif\\x00\\x00"
tiff_header = b"II\\x2a\\x00\\x08\\x00\\x00\\x00"
ifd0 = struct.pack("<HHI I", 0x8825, 4, 1, 26)
ifd0_full = struct.pack("<H", 1) + ifd0 + struct.pack("<I", 0)
gps_entries = 5
gps_ifd = struct.pack("<H", gps_entries)
gps_ifd += struct.pack("<HHII", 0x0000, 1, 4, 0x00000202)
gps_ifd += struct.pack("<HHII", 0x0001, 2, 2, ord("N"))
gps_ifd += struct.pack("<HHII", 0x0002, 5, 3, 92)
gps_ifd += struct.pack("<HHII", 0x0003, 2, 2, ord("E"))
gps_ifd += struct.pack("<HHII", 0x0004, 5, 3, 116)
gps_ifd += struct.pack("<I", 0)
lat_val = struct.pack("<II II II", 26, 1, 39, 1, 0, 1)
lon_val = struct.pack("<II II II", 50, 1, 9, 1, 0, 1)
app1_payload = exif_header + tiff_header + ifd0_full + gps_ifd + lat_val + lon_val
app1_seg = b"\\xff\\xe1" + struct.pack(">H", len(app1_payload) + 2) + app1_payload

com_marker = b"\\xff\\xfe"
com_len = 65535
target_size = 6 * 1024 * 1024 + 150 * 1024
padding = target_size - len(soi) - len(app1_seg) - len(rest)

out_path = '${largeGpsJpg}'
with open(out_path, "wb") as f:
    f.write(soi)
    f.write(app1_seg)
    rem = padding
    while rem > 0:
        sz = min(rem, com_len - 2)
        f.write(com_marker + struct.pack(">H", sz + 2) + (b"X" * sz))
        rem -= sz
    f.write(rest)
PYEOF`);

    // 2. Generate spoofed text file renamed to .jpg
    fs.writeFileSync(fakeJpg, "THIS IS PLAIN TEXT PRETENDING TO BE A JPEG IMAGE");

    // 3. Clear any existing attachments from prior runs in local test db
    try {
      execSync(`psql -d render_neon_playwright_test_db -c "DELETE FROM \\"SiteInspectionAttachments\\" WHERE \\"inspectionId\\" = '${inspectionId}';"`, { stdio: "ignore" });
    } catch {}
  });

  test.afterAll(async () => {
    // Clean up every tracked object in the bucket
    for (const key of trackedStorageKeys) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
      } catch {}
    }
  });

  test("Site Inspection Neon Object Storage Playwright Flow", async ({ page }) => {
    const putRequests: Array<{ url: string; status: number }> = [];
    const allRequests: Array<{ url: string; headers: Record<string, string>; method: string }> = [];

    page.on("console", (msg) => {
      console.log(`[PAGE CONSOLE ${msg.type()}]:`, msg.text());
    });

    page.on("request", (req) => {
      if (req.url().includes("file") || req.url().includes("neon.tech")) {
        console.log("ATTACHMENT/STORAGE REQUEST:", req.method(), req.url());
      }
      allRequests.push({
        url: req.url(),
        headers: req.headers(),
        method: req.method(),
      });
    });

    page.on("response", (res) => {
      if (res.url().includes("file") || res.url().includes("neon.tech")) {
        console.log("ATTACHMENT/STORAGE RESPONSE:", res.status(), res.url());
      }
      if (res.status() >= 400) {
        console.log("FAILED RESPONSE:", res.status(), res.url());
      }
      const req = res.request();
      if (req.method() === "PUT") {
        putRequests.push({ url: req.url(), status: res.status() });
      }
    });

    // Step 1: Login as site_manager
    console.log(">>> Logging in as site_manager@test.local...");
    await page.goto("http://localhost:5173/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "site_manager@test.local");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Step 2: Navigate to Site Inspection Form
    console.log(`>>> Navigating to inspection ${inspectionId}...`);
    await page.goto(`http://localhost:5173/site-inspections/${inspectionId}`);
    await page.waitForLoadState("networkidle");

    // Click step 3 "3. Observations"
    const step3Tab = page.locator('button:has-text("3. Observations")').first();
    await step3Tab.click();
    await page.waitForTimeout(500);

    // Step 3: Upload ~6 MB JPEG with GPS EXIF
    console.log(">>> Uploading ~6 MB JPEG with GPS EXIF...");
    const fileInput = page.locator('input[type="file"]').first();

    // Listen for the completeAttachment network response and the subsequent inspection refetch
    const completePromise = page.waitForResponse(
      (res) => res.url().includes("/attachments/complete") && res.status() === 201
    );
    const refetchPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/site-inspections/${inspectionId}`) && res.request().method() === "GET"
    );

    await fileInput.setInputFiles(largeGpsJpg);

    const completeRes = await completePromise;
    const completeJson = await completeRes.json();
    const uploadedStorageKey = completeJson.storagePath;
    const attachmentId = completeJson.id;
    trackedStorageKeys.push(uploadedStorageKey);

    await refetchPromise;
    await page.waitForTimeout(500);

    // Step 4: Confirm browser PUT went to Neon storage host and not the app
    console.log(">>> Verifying direct browser PUT to Neon storage host...");
    expect(putRequests.length).toBeGreaterThan(0);
    const neonPut = putRequests.find((r) => r.url.includes("neon.tech"));
    expect(neonPut).toBeDefined();
    expect(neonPut!.url).not.toContain("localhost");
    expect(neonPut!.url).not.toContain("5506");
    expect(neonPut!.status).toBe(200);

    // Step 5: Confirm thumbnail and GPS badge appear
    console.log(">>> Checking thumbnail and GPS badge in UI...");
    const gpsBadge = page.locator('[title*="EXIF GPS"]').first();
    await expect(gpsBadge).toBeVisible({ timeout: 15000 });

    const thumbnail = page.locator('img[alt="test_6mb_gps.jpg"]').first();
    await expect(thumbnail).toBeVisible({ timeout: 15000 });
    const src = await thumbnail.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src!).toMatch(/^blob:/);
    console.log(`  [PASS] Thumbnail loaded successfully using blob URL: ${src!.substring(0, 30)}...`);

    // Step 6: Reload page and confirm photo and GPS badge still load
    console.log(">>> Reloading page to verify persistence...");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await step3Tab.click();
    await page.waitForTimeout(500);

    await expect(gpsBadge).toBeVisible({ timeout: 15000 });
    const thumbnailReload = page.locator('img[alt="test_6mb_gps.jpg"]').first();
    await expect(thumbnailReload).toBeVisible({ timeout: 15000 });
    const srcReload = await thumbnailReload.getAttribute("src");
    expect(srcReload!).toMatch(/^blob:/);

    // Step 7: Upload text file renamed .jpg -> confirm rejection
    console.log(">>> Uploading spoofed text file renamed .jpg...");
    await fileInput.setInputFiles(fakeJpg);

    const errorAlert = page.locator('text=magic byte check failed').first();
    await expect(errorAlert).toBeVisible({ timeout: 15000 });
    console.log("  [PASS] Spoofed file correctly rejected!");

    // Step 8: Delete attachment and confirm object is removed from bucket
    console.log(">>> Deleting attachment...");
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    const deleteNetworkPromise = page.waitForResponse(
      (res) => res.url().includes("/attachments/") && res.request().method() === "DELETE"
    );
    await deleteBtn.click();
    await deleteNetworkPromise;
    await page.waitForLoadState("networkidle");

    // Wait until card is removed from UI
    await expect(thumbnail).not.toBeVisible({ timeout: 10000 });

    // Verify object was removed from Neon bucket via HeadObject
    console.log(">>> Checking Neon bucket to confirm object deletion...");
    let objectDeleted = false;
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: uploadedStorageKey }));
    } catch (headErr: any) {
      if (headErr.name === "NotFound" || headErr.$metadata?.httpStatusCode === 404) {
        objectDeleted = true;
      }
    }
    expect(objectDeleted).toBe(true);
    console.log("  [PASS] S3 object confirmed deleted from Neon bucket!");

    // Step 9: Re-upload photo, restart backend, and confirm download still works
    console.log(">>> Re-uploading photo for backend restart test...");
    const reuploadCompletePromise = page.waitForResponse(
      (res) => res.url().includes("/attachments/complete") && res.status() === 201
    );
    const reuploadRefetchPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/site-inspections/${inspectionId}`) && res.request().method() === "GET"
    );
    await fileInput.setInputFiles(largeGpsJpg);
    const reuploadRes = await reuploadCompletePromise;
    const reuploadJson = await reuploadRes.json();
    const secondStorageKey = reuploadJson.storagePath;
    const secondAttId = reuploadJson.id;
    trackedStorageKeys.push(secondStorageKey);

    await reuploadRefetchPromise;
    const secondThumb = page.locator('img[alt="test_6mb_gps.jpg"]').first();
    await expect(secondThumb).toBeVisible({ timeout: 15000 });
    const secondSrc = await secondThumb.getAttribute("src");
    expect(secondSrc!).toMatch(/^blob:/);

    console.log(">>> Restarting backend process...");
    execSync("./scripts/restart-backend.sh", { stdio: "inherit" });

    // Verify photo downloads successfully through backend download route
    console.log(">>> Verifying photo download after backend restart...");
    const token = await page.evaluate(() => sessionStorage.getItem("nexus_token") || localStorage.getItem("token") || "");
    expect(token).toBeTruthy();

    const downloadResponse = await page.request.get(
      `http://localhost:5173/api/v1/site-inspections/${inspectionId}/attachments/${secondAttId}/file`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        maxRedirects: 5,
      }
    );

    expect(downloadResponse.status()).toBe(200);
    const downloadedBody = await downloadResponse.body();
    expect(downloadedBody.length).toBeGreaterThan(6 * 1024 * 1024);
    console.log(`  [PASS] Downloaded ${downloadedBody.length} bytes successfully after backend restart!`);

    // Clean up second attachment from UI
    const secondDeleteBtn = page.locator('button:has-text("Delete")').first();
    const secondDeletePromise = page.waitForResponse(
      (res) => res.url().includes("/attachments/") && res.request().method() === "DELETE"
    );
    await secondDeleteBtn.click();
    await secondDeletePromise;
    await page.waitForLoadState("networkidle");

    // Also confirm second object is deleted
    let secondDeleted = false;
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: secondStorageKey }));
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        secondDeleted = true;
      }
    }
    expect(secondDeleted).toBe(true);

    // Step 10: Network Security Audits
    console.log(">>> Running Network Security Audits...");
    // Confirm no request URL in the entire test contains "token" or "token="
    const requestsWithToken = allRequests.filter((r) => {
      const u = r.url.toLowerCase();
      return u.includes("token=") || u.includes("?token") || u.includes("&token");
    });
    expect(requestsWithToken).toHaveLength(0);
    console.log("  [PASS] Network audit: 0 requests contain token in URL query!");

    // Confirm Authorization header was NEVER sent to the storage host
    const s3Requests = allRequests.filter((r) => r.url.includes("neon.tech"));
    expect(s3Requests.length).toBeGreaterThan(0);
    for (const sReq of s3Requests) {
      expect(sReq.headers["authorization"]).toBeUndefined();
    }
    console.log(`  [PASS] Authorization header was NEVER sent to storage host (${s3Requests.length} storage requests audited)!`);
    console.log("  [PASS] All E2E steps passed successfully!");
  });
});
