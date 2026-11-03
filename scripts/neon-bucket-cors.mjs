import fs from "fs";
import path from "path";
import os from "os";
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

// Parse environment file from ~/.site-inspection-bucket.env without printing secrets
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

async function configureCors() {
  const env = loadBucketEnv();
  const bucket = env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET not found in credential file");
  }

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

  const corsRule = {
    AllowedOrigins: [
      "https://crm-k8g4.onrender.com",
      "http://localhost:5173",
    ],
    AllowedMethods: ["GET", "PUT"],
    AllowedHeaders: ["Content-Type"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  };

  console.log(`Setting CORS on bucket: ${bucket}`);
  console.log("Allowed Origins:", corsRule.AllowedOrigins);
  console.log("Allowed Methods:", corsRule.AllowedMethods);
  console.log("Allowed Headers:", corsRule.AllowedHeaders);
  console.log("Expose Headers:", corsRule.ExposeHeaders);
  console.log("MaxAgeSeconds:", corsRule.MaxAgeSeconds);

  try {
    const putCmd = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [corsRule],
      },
    });
    await client.send(putCmd);
    console.log("PutBucketCors succeeded.");

    const getCmd = new GetBucketCorsCommand({
      Bucket: bucket,
    });
    const getRes = await client.send(getCmd);
    console.log("GetBucketCors returned active rules:");
    console.log(JSON.stringify(getRes.CORSRules, null, 2));
    console.log("CORS verification: PASS");
  } catch (err) {
    console.error("CORS operation failed.");
    console.error("Error Code:", err.name || err.Code || "UnknownError");
    console.error("Error Message:", err.message || String(err));
    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      console.error(
        "Action required: The S3 access credentials do not have permission to execute PutBucketCors / GetBucketCors. " +
        "Ensure the Neon bucket policy or S3 user permissions grant s3:PutBucketCORS and s3:GetBucketCORS."
      );
    } else if (err.name === "NoSuchBucket" || err.$metadata?.httpStatusCode === 404) {
      console.error(
        "Action required: The bucket does not exist or endpoint is incorrect. Check S3_BUCKET and S3_ENDPOINT."
      );
    } else {
      console.error("Action required: Check S3 endpoint connectivity, region, and bucket settings in Neon console.");
    }
    process.exit(1);
  }
}

configureCors();
