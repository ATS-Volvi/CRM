const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require("@aws-sdk/client-s3");

// Attempt to load .env files if present (backend/.env, root .env, ~/.site-inspection-bucket.env)
function tryLoadEnv() {
  try {
    const dotenv = require("dotenv");
    const candidates = [
      path.resolve(process.cwd(), "backend/.env"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(__dirname, "../backend/.env"),
      path.resolve(__dirname, "../.env"),
      path.join(os.homedir(), ".site-inspection-bucket.env"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p, override: false });
      }
    }
  } catch {
    // dotenv is optional if env vars are already exported
  }
}

tryLoadEnv();

const EXPECTED_CORS_RULES = [
  {
    AllowedOrigins: ["https://crm-k8g4.onrender.com", "http://localhost:5173"],
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3000,
  },
];

async function setS3Cors() {
  const bucket =
    process.env.S3_BUCKET_NAME ||
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    "";
  const region =
    process.env.AWS_REGION ||
    process.env.S3_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL;

  console.log("=================================================");
  console.log("  Nexus CRM - Apply S3 Bucket CORS Configuration");
  console.log("=================================================");

  const missing = [];
  if (!bucket) missing.push("S3_BUCKET_NAME (or S3_BUCKET)");
  if (!accessKeyId) missing.push("AWS_ACCESS_KEY_ID (or S3_ACCESS_KEY_ID)");
  if (!secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY (or S3_SECRET_ACCESS_KEY)");

  if (missing.length > 0) {
    console.error(`\n❌ Error: Missing required environment variables:\n   - ${missing.join("\n   - ")}`);
    console.error("\nPlease set these in your shell or backend/.env file before running this script.");
    console.error("Example:");
    console.error("  export AWS_REGION=eu-west-1");
    console.error("  export S3_BUCKET_NAME=my-crm-bucket");
    console.error("  export AWS_ACCESS_KEY_ID=AKIA...");
    console.error("  export AWS_SECRET_ACCESS_KEY=...");
    console.error("  npm run s3:cors\n");
    process.exit(1);
  }

  console.log(`Bucket:   ${bucket}`);
  console.log(`Region:   ${region}`);
  if (endpoint) console.log(`Endpoint: ${endpoint}`);
  console.log("\nApplying CORS rules:");
  console.log(JSON.stringify(EXPECTED_CORS_RULES, null, 2));

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      process.env.S3_FORCE_PATH_STYLE === "1",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    const putCmd = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: EXPECTED_CORS_RULES,
      },
    });

    await client.send(putCmd);
    console.log("\n✅ PutBucketCorsCommand executed successfully!");

    // Verify
    const getCmd = new GetBucketCorsCommand({ Bucket: bucket });
    const getRes = await client.send(getCmd);
    console.log("\nActive CORS rules verified on S3 bucket:");
    console.log(JSON.stringify(getRes.CORSRules, null, 2));
    console.log("\n✅ S3 CORS configuration is ACTIVE and verified.\n");
  } catch (err) {
    console.error("\n❌ Failed to set bucket CORS:");
    console.error(`Error Code:    ${err.name || err.Code || "UnknownError"}`);
    console.error(`Error Message: ${err.message || String(err)}`);

    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      console.error(
        "\nAction Required: The IAM user/credentials lack the 's3:PutBucketCors' permission on this bucket."
      );
      console.error("Either add 's3:PutBucketCors' to the IAM policy, or apply the CORS config manually in AWS Console.");
    } else if (err.name === "NoSuchBucket" || err.$metadata?.httpStatusCode === 404) {
      console.error(
        "\nAction Required: Bucket not found. Check S3_BUCKET_NAME and AWS_REGION to ensure they match."
      );
    }
    process.exit(1);
  }
}

if (require.main === module) {
  setS3Cors().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { setS3Cors, EXPECTED_CORS_RULES };
