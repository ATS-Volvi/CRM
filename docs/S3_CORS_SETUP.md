# S3 Bucket CORS & Storage Setup Guide

This guide details how to configure Cross-Origin Resource Sharing (CORS), environment variables, and IAM permissions for Site Inspection file uploads in Nexus CRM.

---

## 1. Automated Setup via npm script

Run the automated script from the repository root:

```bash
npm run s3:cors
```

This script reads your S3 credentials from environment variables (or `.env` files) and executes `PutBucketCorsCommand` using `@aws-sdk/client-s3`.

---

## 2. Manual Setup via AWS Management Console

If you prefer to configure CORS manually via the AWS Console:

1. Open the [AWS Management Console](https://console.aws.amazon.com/s3/).
2. Navigate to **Amazon S3** > **Buckets**.
3. Click on your bucket name (e.g., `nexus-crm-inspections` or the value in `S3_BUCKET_NAME`).
4. Select the **Permissions** tab.
5. Scroll down to **Cross-origin resource sharing (CORS)** and click **Edit**.
6. Paste the following JSON configuration into the editor:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://crm-k8g4.onrender.com",
      "http://localhost:5173"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

7. Click **Save changes**.

---

## 3. Required Environment Variables

Ensure the following environment variables are set on your deployment platform (e.g., **Render Dashboard** under Environment Variables) and in your local `.env`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `STORAGE_DRIVER` | Set to `s3` to enable direct S3 uploads | `s3` |
| `AWS_REGION` *(or `S3_REGION`)* | The exact AWS region of your bucket (must match bucket region to prevent 301/307 redirects lacking CORS headers) | `us-east-1` |
| `S3_BUCKET_NAME` *(or `S3_BUCKET`)* | The exact name of your S3 bucket | `nexus-crm-inspections` |
| `AWS_ACCESS_KEY_ID` *(or `S3_ACCESS_KEY_ID`)* | IAM User Access Key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` *(or `S3_SECRET_ACCESS_KEY`)* | IAM User Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `S3_ENDPOINT` *(optional)* | Custom regional/compatible endpoint (e.g. Neon, Cloudflare R2, MinIO) | `https://s3.us-east-1.amazonaws.com` |

> **IMPORTANT**: If `AWS_REGION` is omitted or does not match the bucket's actual creation region, AWS S3 redirects preflight OPTIONS and PUT requests with a `301/307 Temporary Redirect`. S3 redirects do NOT include CORS headers (`Access-Control-Allow-Origin`), causing browsers to immediately block file uploads.

---

## 4. Required IAM User Permissions

The IAM user credentials configured in `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` require permissions to generate presigned upload URLs, verify uploaded file contents on completion, and optionally update CORS.

Attach an inline or managed IAM policy to your IAM user with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SiteInspectionObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "SiteInspectionBucketConfig",
      "Effect": "Allow",
      "Action": [
        "s3:PutBucketCORS",
        "s3:GetBucketCORS"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    }
  ]
]
```

### Permission Breakdown:
- **`s3:PutObject`**: Required for the frontend to upload files directly to S3 using the presigned URL.
- **`s3:GetObject`**: Required by the backend during `/attachments/complete` to read metadata and inspect initial bytes for magic byte verification, as well as serving attachment thumbnails/downloads.
- **`s3:DeleteObject`**: Required to clean up files if magic byte verification fails or when a user deletes an attachment.
- **`s3:PutBucketCORS` / `s3:GetBucketCORS`**: Required if using the automated `npm run s3:cors` script.
