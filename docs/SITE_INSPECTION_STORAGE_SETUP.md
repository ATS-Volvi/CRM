# Site Inspection Object Storage Setup Guide (S3, Cloudflare R2, Supabase)

This document provides setup instructions for configuring S3-compatible cloud object storage for Site Inspection attachments in the Nexus Sales CRM.

---

## 1. CORS Configuration

Browser-direct uploads use pre-signed `PUT` requests that connect directly from the user's browser to the storage bucket. Therefore, the bucket must have a CORS policy allowing `PUT` and `GET` from your CRM frontend domain.

### S3 / Supabase CORS Configuration (JSON)
```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://YOUR-FRONTEND-DOMAIN"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
> [!IMPORTANT]
> - Replace `https://YOUR-FRONTEND-DOMAIN` with your actual frontend domain (e.g., `https://nexus-crm.vercel.app`).
> - Do **NOT** include a trailing slash in the origin URL (`https://example.com/` is invalid for CORS origins; use `https://example.com`).
> - Do **NOT** use wildcards (`*`) in production.

### Cloudflare R2 CORS Configuration
In Cloudflare Dashboard, go to **R2** ➔ select your bucket ➔ **Settings** ➔ **CORS Policy** ➔ click **Add Rule** or paste JSON:
```json
[
  {
    "AllowedOrigins": [
      "https://YOUR-FRONTEND-DOMAIN"
    ],
    "AllowedMethods": [
      "GET",
      "PUT"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 2. Minimal-Permission IAM Policy

Access credentials should be strictly limited to the single bucket used for site inspection attachments.

### AWS IAM Policy Example
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    },
    {
      "Sid": "ObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

---

## 3. Vercel Environment Variables

Add the following environment variable names in the Vercel Project Dashboard under **Settings ➔ Environment Variables**:

| Variable Name | Description | Environment Target |
| :--- | :--- | :--- |
| `STORAGE_DRIVER` | Set to `s3` | Add to **Preview** first, then **Production** |
| `S3_BUCKET` | Name of your private bucket | Add to **Preview** first, then **Production** |
| `S3_REGION` | Bucket region or `auto` for Cloudflare R2 | Add to **Preview** first, then **Production** |
| `S3_ENDPOINT` | Custom API endpoint URL (for R2 or Supabase) | Add to **Preview** first, then **Production** |
| `S3_ACCESS_KEY_ID` | Storage access key ID | Add to **Preview** first, then **Production** |
| `S3_SECRET_ACCESS_KEY`| Storage secret access key | Add to **Preview** first, then **Production** |
| `S3_FORCE_PATH_STYLE`| Set to `true` for Supabase / MinIO | Add to **Preview** first, then **Production** |

### Redeploy Step
After saving environment variables in Vercel:
1. Navigate to the **Deployments** tab.
2. Select your deployment (or the latest deployment) and click **Redeploy** so the new variables are loaded by the serverless functions.

---

## 4. Provider-Specific Setup Guides

### A. Cloudflare R2
1. **Create Bucket**: In the Cloudflare Dashboard, go to **R2 ➔ Create bucket** (e.g. `nexus-site-inspections`).
2. **Configure CORS**:
   - In bucket settings, under **CORS Policy**, add the rule from Section 1 above with your frontend origin.
3. **Generate Credentials**:
   - Go to **Manage R2 API Tokens ➔ Create API Token**.
   - Permission: **Object Read & Write**.
   - Scope: Specify your bucket (`nexus-site-inspections`).
4. **Vercel Settings for R2**:
   - `STORAGE_DRIVER`: `s3`
   - `S3_BUCKET`: `nexus-site-inspections`
   - `S3_REGION`: `auto`
   - `S3_ENDPOINT`: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (found on the R2 overview page)
   - `S3_ACCESS_KEY_ID`: `<R2_ACCESS_KEY_ID>`
   - `S3_SECRET_ACCESS_KEY`: `<R2_SECRET_ACCESS_KEY>`
   - `S3_FORCE_PATH_STYLE`: `false` (or leave unset)

### B. Supabase Storage (S3-Compatible Endpoint)
1. **Create Bucket**:
   - In your Supabase Project dashboard, go to **Storage ➔ New Bucket**.
   - Bucket Name: `nexus-site-inspections`.
   - Toggle Public bucket: **OFF** (Keep bucket private).
2. **Generate S3 Access Keys**:
   - Go to **Project Settings ➔ Storage ➔ S3 Access Keys**.
   - Click **Generate new token / key**.
   - Note the `Access Key ID` and `Secret Access Key`.
3. **Configure CORS**:
   - Open bucket configuration and apply the CORS JSON from Section 1 with your frontend origin.
4. **Vercel Settings for Supabase**:
   - `STORAGE_DRIVER`: `s3`
   - `S3_BUCKET`: `nexus-site-inspections`
   - `S3_REGION`: your Supabase project region (e.g., `us-east-1` or `eu-central-1`)
   - `S3_ENDPOINT`: `https://<PROJECT_REF>.supabase.co/storage/v1/s3`
   - `S3_ACCESS_KEY_ID`: `<S3_ACCESS_KEY_ID>`
   - `S3_SECRET_ACCESS_KEY`: `<S3_SECRET_ACCESS_KEY>`
   - `S3_FORCE_PATH_STYLE`: `true` (Supabase S3 endpoint requires path-style addressing)

---

## 5. Rollback Procedure

If any storage connectivity or CORS issues occur in production:
1. In Vercel Project Settings ➔ Environment Variables, update:
   ```text
   STORAGE_DRIVER=local
   ```
2. Trigger a **Redeploy** in Vercel.
3. The application will immediately fall back to local disk storage (`/tmp/uploads` on Vercel) without causing downtime or blocking CRM operations.
