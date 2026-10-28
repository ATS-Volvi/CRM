# Render Deployment Runbook — Site Inspection Feature & Production Service

This runbook guides the complete, safe deployment of Nexus Sales CRM to Render with the Site Inspection feature and S3 object storage (no paid persistent disk required).

> **CRITICAL RULE**: Follow these steps in the exact sequential order listed below. Steps requiring the Render Dashboard, production credentials, or a physical mobile device are explicitly marked with **[Only the owner can do this]**.

---

### Step A: Verify Existing Render Web Service & PostgreSQL Database
**[Only the owner can do this]**

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Check if a Render Web Service (e.g. `nexus-crm` or `crm-k8g4`) and a PostgreSQL database (e.g. Neon or Render Postgres) already exist.
3. **If yes, REUSE THEM.**
   - **Do NOT create a new database.**
   - **Do NOT delete or recreate the existing service.**
   - Retain the existing `DATABASE_URL` and `JWT_SECRET` unchanged to prevent service disruption or user session invalidation.

---

### Step B: Pre-Deployment Database Backup with `pg_dump`
**[Only the owner can do this]**

Before deploying, capture a complete, restorable backup of the production database using your local Mac terminal. Use the zsh-safe `read -s "PROD_DB?..."` syntax so credentials are not echoed or stored in shell history.

```zsh
# 1. Prompt for the production database connection string with hidden input
read -s "PROD_DB?Paste production DATABASE_URL: "
echo

# 2. Clean pooler/parameter flags if needed for pg_dump compatibility
PROD_DUMP_URL="${PROD_DB/-pooler/}"
PROD_DUMP_URL="${PROD_DUMP_URL/&channel_binding=require/}"

# 3. Create a timestamped backup file
BACKUP_FILE="backup_pre_site_inspection_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "$PROD_DUMP_URL" --format=custom --file="$BACKUP_FILE"

# 4. Verify the backup file was created and is not empty
if [[ -s "$BACKUP_FILE" ]]; then
  echo "PASS: Backup successfully created: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes)"
else
  echo "FAIL: Backup file is empty or was not created!"
  exit 1
fi

# 5. Clear sensitive shell variables
unset PROD_DB PROD_DUMP_URL
```

Keep this `.dump` file safe in a secure local storage directory.

---

### Step C: Render Service Settings & Environment Variables
**[Only the owner can do this]**

In the Render Dashboard, open your Web Service and configure **Settings**:

#### 1. Service Runtime & Build Configuration
| Setting | Exact Value |
| :--- | :--- |
| **Environment / Runtime** | `Node` |
| **Branch** | `main` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm run start:backend` |
| **Pre-deploy Command** | *(Leave blank — migrations are run manually from Mac)* |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | `Yes` (or trigger manually after saving) |

#### 2. Environment Variables to Set
Navigate to **Environment** tab in your Render Web Service. Add or update the following variables (names only):

- **Required System Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000` (Render's internal port)
  - `DATABASE_URL`: *(Your existing Neon/Render PostgreSQL Connection String)*
  - `JWT_SECRET`: *(Your existing JWT signing secret string)*
  - `SITE_INSPECTION_GATE`: `off` *(Set to `off` initially so existing lead qualification is uninterrupted while migrations and smoke tests run)*
  - `CORS_ORIGIN`: `https://<your-render-domain>.onrender.com` *(Optional: same-origin browser calls do not require CORS, but configure your frontend domain if accessing from an external URL)*

- **Site Inspection S3 Object Storage Driver (Free Bucket — No Persistent Disk Required)**:
  - `STORAGE_DRIVER`: `s3`
  - `S3_BUCKET`: *(Your bucket name, e.g. Cloudflare R2 or AWS S3 free tier)*
  - `S3_REGION`: *(e.g. auto for R2, or us-east-1)*
  - `S3_ENDPOINT`: *(e.g. https://<account_id>.r2.cloudflarestorage.com or AWS endpoint)*
  - `S3_ACCESS_KEY_ID`: *(Bucket access key ID)*
  - `S3_SECRET_ACCESS_KEY`: *(Bucket secret access key)*
  - `S3_FORCE_PATH_STYLE`: `true`

---

### Step D: Object Storage Configuration (Free Bucket, No Disk)
**[Only the owner can do this]**

> **No Paid Persistent Disk Needed**: The Site Inspection feature uses `STORAGE_DRIVER=s3`. Photos and inspection documents are uploaded directly to an S3-compatible bucket (e.g., Cloudflare R2 free tier with 10 GB/mo free, or AWS S3 free tier).
>
> **Do NOT attach a paid disk** on Render. The application runs on the standard Web Service plan without local persistent storage dependencies.

Ensure your S3/R2 bucket CORS allows `PUT`, `GET`, `HEAD`, `DELETE` from your frontend origin:
```json
[
  {
    "AllowedOrigins": ["https://<your-service>.onrender.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

### Step E: Run Database Migrations by Hand from Mac & Deploy
**[Only the owner can do this]**

Because Render pre-deploy commands are not relied upon, execute database migrations directly and safely from your Mac terminal before releasing:

1. **Run Migrations Locally**:
```zsh
# Read production DATABASE_URL into a temporary variable with hidden input
read -s "PROD_DB?Paste production DATABASE_URL: "
echo

# Normalize connection string if pooler or channel binding flag is present
PROD_DB=${PROD_DB/-pooler/}
PROD_DB=${PROD_DB/&channel_binding=require/}

# Execute migration
if [[ "$PROD_DB" == postgres* ]]; then
  DATABASE_URL="$PROD_DB" npx sequelize-cli db:migrate
else
  echo "STOPPED: that is not a database address."
  exit 1
fi
unset PROD_DB
```

2. **Verify Migration Output**:
Confirm the migration log output displays:
```text
== 20261025000000-create-site-inspection-tables: migrated
```
*(If already applied, it will report "No migrations were executed, database schema was already up to date".)*

3. **Verify Tables via PSQL**:
```zsh
read -s "PROD_DB?Paste production DATABASE_URL: "
echo
PROD_DB=${PROD_DB/-pooler/}
PROD_DB=${PROD_DB/&channel_binding=require/}
psql "$PROD_DB" -c "SELECT code FROM \"SiteBases\";"
unset PROD_DB
```
Confirm the 4 seeded bases (`JUBAIL`, `JAFURAH`, `YANBU`, `RIYADH`) are present.

4. **Deploy & Run Smoke Script**:
Trigger the deploy on Render (or push merged commit to `main`). Once the Render Web Service shows **Live**, run:
```bash
./scripts/render-smoke.sh https://<your-service-name>.onrender.com
```
Confirm all checks output `PASS`.

---

### Step F: Create Roles `site_manager` and `ops_manager` in the CRM
**[Only the owner can do this]**

1. Log into the Nexus CRM web application as an Administrator.
2. Navigate to **Team / Users** (or `/settings`).
3. Create at least one user with role **Site Manager** (`site_manager`). Ensure `isAvailable: true` and team/territory is set.
4. Create at least one user with role **Operations Manager** (`ops_manager`).
5. These users will be eligible to perform and approve site assessments.

---

### Step G: End-to-End Test Lead Verification with Real Mobile Photo
**[Only the owner can do this]**

1. In the CRM, create a new lead named **"ZZ TEST Lead"** with a valid email and phone number.
2. Click **Contact** / Log Call to move the lead into active stage.
3. Request a Site Inspection for the lead.
4. Assign the inspection to your test `site_manager`.
5. Open the Site Inspection form (`/site-inspections/<id>`):
   - **Step 1**: Select an Operations Base, confirm GPS coordinates, client details, and mobilization distance.
   - **Step 2**: Select at least one active waste service (Sewage, General, or Hazardous), select the disposal facility, and enter distance and road condition.
   - **Step 3**: Using a smartphone or camera device, take a real photo with GPS location services enabled and upload the photo (JPEG) and an optional PDF. Confirm the photo thumbnail and GPS coordinates display.
   - Check the accuracy acknowledgement and click **Submit Assessment**.
6. Log in as the `ops_manager`:
   - Click **Request Changes**, add a test review note.
   - Log back in as `site_manager` and click **Re-Submit**.
   - Log back in as `ops_manager` and click **Approve Inspection**.
7. In the CRM, click **Qualify Lead** on the test lead. Verify the lead transitions to **QUALIFIED** and converts to an Opportunity.
8. **Test Persistence in S3 Bucket Across Restart**:
   - In the Render Dashboard, go to your Web Service and click **Manual Deploy** → **Restart Service**.
   - Once restarted, open the inspection attachments or click Download Photo.
   - Confirm the photo downloads and renders completely, proving S3 object storage persistence.

---

### Step H: Clean Up Test Lead & Enforce Site Inspection Gate
**[Only the owner can do this]**

1. In the CRM, delete or archive the **"ZZ TEST Lead"** and its associated Opportunity.
2. In the Render Dashboard, navigate to **Environment**:
   - Either delete the `SITE_INSPECTION_GATE` variable or change its value from `off` to `on`.
   - *(Note: In code, `SITE_INSPECTION_GATE` defaults to ON whenever unset.)*
3. Save changes. Render will redeploy the service.
4. From this point forward, leads requiring an inspection cannot be qualified without an approved site inspection.

---

### Step I: Align Vercel Project Gate Configuration
**[Only the owner can do this]**

If the frontend or an API mirror is still deployed or active on Vercel:
1. Open the [Vercel Dashboard](https://vercel.com).
2. Go to your Project → **Settings** → **Environment Variables**.
3. Set `SITE_INSPECTION_GATE=off` in Production and Preview environments until the production database connection on Vercel is confirmed fully migrated and tested.
4. Once verified, remove or set to `on`.

---

### Step J: Emergency Rollback Procedure
**[Only the owner can do this]**

If an unforeseen issue occurs after deployment:
1. **Disable the Gate Immediately**:
   - In Render Dashboard → **Environment**, set `SITE_INSPECTION_GATE=off`.
   - Save changes. This immediately unblocks sales reps from qualifying and converting leads while the issue is investigated.
2. **Rollback Service Code**:
   - In Render Dashboard → **Deploys**, find the deploy preceding this release.
   - Click the three dots (`...`) next to that deploy and select **Rollback to this deploy**.
3. **Database Migration Safety**:
   - **DO NOT run `npx sequelize-cli db:migrate:undo`** unless you are prepared to permanently delete all site inspection tables, history, and uploaded records.
   - The migration `20261025000000-create-site-inspection-tables.js` is strictly additive. Leaving the tables in the database is backward-compatible with older backend code and causes no errors.
