import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function loadBucketEnv() {
  const envPath = path.join(os.homedir(), ".site-inspection-bucket.env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`Credential file not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

async function runTests() {
  const env = loadBucketEnv();
  const bucket = env.S3_BUCKET;
  const client = new S3Client({
    region: env.S3_REGION || "us-east-1",
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true" || env.S3_FORCE_PATH_STYLE === "1",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
    },
  });

  const randId = crypto.randomBytes(8).toString("hex");
  const key1 = `site-inspections/_test/test_${randId}_direct.txt`;
  const key2 = `site-inspections/_test/test_${randId}_presigned.txt`;

  const results = {};
  const testPayload = "0123456789ABCDEF0123456789ABCDEF"; // 32 bytes

  console.log("=== NEON OBJECT STORAGE S3 COMPATIBILITY TEST ===");
  console.log(`Bucket: ${bucket}`);
  console.log(`Endpoint: ${env.S3_ENDPOINT}`);
  console.log(`Path Style: ${env.S3_FORCE_PATH_STYLE}`);
  console.log(`Direct Key: ${key1}`);
  console.log(`Presigned Key: ${key2}`);
  console.log("");

  // 1. PutObject
  try {
    const putRes = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key1,
        Body: Buffer.from(testPayload, "utf-8"),
        ContentType: "text/plain",
      })
    );
    console.log("[1] PutObject: PASS (ETag:", putRes.ETag, ")");
    results.PutObject = "PASS";
  } catch (err) {
    console.error("[1] PutObject: FAIL -", err.name, err.message);
    results.PutObject = `FAIL: ${err.name}`;
  }

  // 2. HeadObject
  try {
    const headRes = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key1,
      })
    );
    if (headRes.ContentLength === 32 && headRes.ContentType?.includes("text/plain")) {
      console.log(`[2] HeadObject: PASS (Length: ${headRes.ContentLength}, ContentType: ${headRes.ContentType})`);
      results.HeadObject = "PASS";
    } else {
      console.warn(`[2] HeadObject: FAIL (Unexpected values Length: ${headRes.ContentLength}, Type: ${headRes.ContentType})`);
      results.HeadObject = `FAIL (Length: ${headRes.ContentLength})`;
    }
  } catch (err) {
    console.error("[2] HeadObject: FAIL -", err.name, err.message);
    results.HeadObject = `FAIL: ${err.name}`;
  }

  // 3. Range GET (bytes=0-15)
  try {
    const getRangeRes = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key1,
        Range: "bytes=0-15",
      })
    );
    const chunks = [];
    for await (const chunk of getRangeRes.Body) {
      chunks.push(chunk);
    }
    const rangeBuf = Buffer.concat(chunks);
    const rangeStr = rangeBuf.toString("utf-8");
    if (rangeBuf.length === 16 && rangeStr === "0123456789ABCDEF") {
      console.log(`[3] Range GET (bytes=0-15): PASS (Received 16 bytes: "${rangeStr}")`);
      results.RangeGet = "PASS";
    } else {
      console.error(`[3] Range GET: FAIL (Received ${rangeBuf.length} bytes: "${rangeStr}")`);
      results.RangeGet = `FAIL: expected 16 bytes got ${rangeBuf.length}`;
    }
  } catch (err) {
    console.error("[3] Range GET: FAIL -", err.name, err.message);
    results.RangeGet = `FAIL: ${err.name}`;
  }

  // 4. Presigned PUT with Content-Type locked
  try {
    const presignPutUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key2,
        ContentType: "text/plain",
      }),
      {
        expiresIn: 300,
        signableHeaders: new Set(["content-type"]),
      }
    );

    // Mismatched Content-Type test (should fail / be locked)
    const badContentTypeRes = await fetch(presignPutUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: "mismatched content",
    });
    const contentTypeLocked = !badContentTypeRes.ok; // 403 / SignatureDoesNotMatch

    // Correct Content-Type upload
    const presignPutPayload = "Presigned PUT content from test runner";
    const goodPutRes = await fetch(presignPutUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: presignPutPayload,
    });

    if (goodPutRes.ok) {
      console.log(
        `[4] Presigned PUT (Content-Type locked): PASS (Status: ${goodPutRes.status}, Content-Type locked verification: ${contentTypeLocked ? "YES (rejected mismatch)" : "NO"})`
      );
      results.PresignedPut = "PASS";
      results.ContentTypeLocked = contentTypeLocked ? "PASS" : "WARN: not enforced by SigV4";
    } else {
      const errText = await goodPutRes.text();
      console.error(`[4] Presigned PUT: FAIL (${goodPutRes.status} ${goodPutRes.statusText}) - ${errText}`);
      results.PresignedPut = `FAIL: ${goodPutRes.status}`;
    }
  } catch (err) {
    console.error("[4] Presigned PUT: FAIL -", err.name, err.message);
    results.PresignedPut = `FAIL: ${err.name}`;
  }

  // 5. Presigned GET
  try {
    const presignGetUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key2,
      }),
      { expiresIn: 60 }
    );

    const getFetchRes = await fetch(presignGetUrl);
    if (getFetchRes.ok) {
      const fetchedText = await getFetchRes.text();
      if (fetchedText === "Presigned PUT content from test runner") {
        console.log(`[5] Presigned GET: PASS (Status: ${getFetchRes.status}, Content verified)`);
        results.PresignedGet = "PASS";
      } else {
        console.error(`[5] Presigned GET: FAIL (Unexpected content: "${fetchedText}")`);
        results.PresignedGet = "FAIL: Content mismatch";
      }
    } else {
      console.error(`[5] Presigned GET: FAIL (${getFetchRes.status} ${getFetchRes.statusText})`);
      results.PresignedGet = `FAIL: ${getFetchRes.status}`;
    }
  } catch (err) {
    console.error("[5] Presigned GET: FAIL -", err.name, err.message);
    results.PresignedGet = `FAIL: ${err.name}`;
  }

  // 6. DeleteObject
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key1 }));
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key2 }));

    // Confirm deletion via HeadObject -> should throw 404 / NotFound
    let key1Gone = false;
    let key2Gone = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key1 }));
    } catch (e) {
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) key1Gone = true;
    }
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key2 }));
    } catch (e) {
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) key2Gone = true;
    }

    if (key1Gone && key2Gone) {
      console.log("[6] DeleteObject: PASS (Both test keys deleted and verified gone)");
      results.DeleteObject = "PASS";
    } else {
      console.error(`[6] DeleteObject: FAIL (key1Gone: ${key1Gone}, key2Gone: ${key2Gone})`);
      results.DeleteObject = "FAIL: Objects still exist";
    }
  } catch (err) {
    console.error("[6] DeleteObject: FAIL -", err.name, err.message);
    results.DeleteObject = `FAIL: ${err.name}`;
  }

  // 7. Check Credential Capabilities (What it CAN and CANNOT do)
  console.log("\n--- Credential Capability Audit ---");

  // A. Can it ListObjectsV2?
  try {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "site-inspections/",
        MaxKeys: 10,
      })
    );
    console.log(`[Capability] ListObjectsV2: ALLOWED (Found ${listRes.KeyCount || 0} existing objects)`);
    results.CapabilityListObjects = "ALLOWED";
    if (listRes.Contents && listRes.Contents.length > 0) {
      console.log("Existing objects in bucket (prefix: site-inspections/):");
      for (const obj of listRes.Contents) {
        console.log(` - ${obj.Key} (${obj.Size} bytes, modified: ${obj.LastModified?.toISOString()})`);
      }
    } else {
      console.log("No existing objects found under prefix site-inspections/.");
    }
  } catch (err) {
    console.log(`[Capability] ListObjectsV2: DENIED (${err.name}: ${err.message})`);
    results.CapabilityListObjects = `DENIED: ${err.name}`;
  }

  // B. Can it initiate Multipart Upload?
  try {
    const mpRes = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: `site-inspections/_test/mp_${randId}.tmp`,
      })
    );
    console.log("[Capability] CreateMultipartUpload: ALLOWED");
    results.CapabilityMultipartUpload = "ALLOWED";

    // Abort it immediately so no dangling parts remain
    if (mpRes.UploadId) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: `site-inspections/_test/mp_${randId}.tmp`,
          UploadId: mpRes.UploadId,
        })
      );
      console.log("[Capability] AbortMultipartUpload: ALLOWED (Cleaned up)");
    }
  } catch (err) {
    console.log(`[Capability] MultipartUpload: DENIED (${err.name}: ${err.message})`);
    results.CapabilityMultipartUpload = `DENIED: ${err.name}`;
  }

  console.log("\n=== TEST SUMMARY ===");
  console.table(results);

  // Return non-zero if any core test failed
  const failed = Object.entries(results).filter(
    ([k, v]) => !k.startsWith("Capability") && !v.startsWith("PASS")
  );
  if (failed.length > 0) {
    console.error("Some tests failed:", failed);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
