# Render Deployment Runbook — Site Inspection Feature & Production Service

This runbook guides the complete, safe deployment of Nexus Sales CRM to Render with the Site Inspection feature and persistent disk storage.

> **CRITICAL RULE**: Follow these steps in the exact sequential order listed below. Steps requiring the Render Dashboard, production credentials, or a physical mobile device are explicitly marked with **[Only the owner can do this]**.

---

### Step A: Verify Existing Render Web Service & PostgreSQL Database
**[Only the owner can do this]**

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Check if a Render Web Service (e.g. `nexus-crm` or `crm-k8g4`) and a Render PostgreSQL database already exist.
3. **If yes, REUSE THEM.**
   - **Do NOT create a new database.**
   - **Do NOT delete or recreate the existing service.**
   - Retain the existing `DATABASE_URL` and `JWT_SECRET` unchanged to avoid service outage or user session invalidation.
4. If no PostgreSQL database exists yet, create one in the Render Dashboard (**PostgreSQL**, plan: Starter or higher, Region matching your target audience).

---

### Step B: Pre-Deployment Database Backup with `pg_dump`
**[Only the owner can do this]**

Before deploying any migrations, capture a complete, restorable backup of the production database using your local terminal. Use the zsh-safe `read -s "PROD_DB?..."` syntax so credentials are not echoed or stored in shell history.

```zsh
# 1. Prompt for the production database connection string with hidden input
read -s "PROD_DB?Paste production DATABASE_URL: "
echo

# 2. Validate non-empty input
if [[ -z "$PROD_DB" ]]; then
  echo "Error: PROD_DB is empty."
  exit 1
fi

# 3. Create a timestamped backup file
BACKUP_FILE="backup_pre_site_inspection_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "$PROD_DB" --format=custom --file="$BACKUP_FILE"

# 4. Verify the backup file was created and is not empty
if [[ -s "$BACKUP_FILE" ]]; then
  echo "PASS: Backup successfully created: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes)"
else
  echo "FAIL: Backup file is empty or was not created!"
  exit 1
fi

# 5. Clear the sensitive shell variable
unset PROD_DB
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
| **Pre-deploy Command** | `npm run migrate` |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | `Yes` (or trigger manually after saving) |

#### 2. Environment Variables to Set
Navigate to **Environment** tab in your Render Web Service. Add or update the following variables (names only):

- **Required System Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000` (Render's internal port)
  - `DATABASE_URL`: *(Your existing Render PostgreSQL External/Internal Connection String)*
  - `JWT_SECRET`: *(Your existing JWT signing secret string)*
  - `UPLOAD_DIR`: `/var/data/uploads`
  - `SITE_INSPECTION_GATE`: `off` *(Set to `off` initially so existing lead qualification is uninterrupted while migrations and smoke tests run)*
  - `CORS_ORIGIN`: `https://<your-render-domain>.onrender.com` *(Optional: browser calls to the backend on the same origin do not require CORS, but configure your frontend domain if accessing from an external URL)*

- **Site Inspection Storage Driver (Optional S3 Driver)**:
  - If using local persistent disk (recommended default):
    - `STORAGE_DRIVER`: `local` (or leave unset)
  - If using Cloudflare R2 / AWS S3 object storage instead of disk:
    - `STORAGE_DRIVER`: `s3`
    - `S3_BUCKET`
    - `S3_REGION`
    - `S3_ENDPOINT`
    - `S3_ACCESS_KEY_ID`
    - `S3_SECRET_ACCESS_KEY`
    - `S3_FORCE_PATH_STYLE`

- **Optional Integration Variables (leave existing intact if already configured)**:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_TOKEN`
  - `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`
  - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`
  - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_ENCRYPTION_KEY`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`
  - `INTENT_FILTER_MODE`, `INTENT_MODEL`

---

### Step D: Attach Persistent Disk & Set `UPLOAD_DIR`
**[Only the owner can do this]**

> **Note on Plan Requirements**: Render Web Services require a paid instance type (e.g. **Starter** at $7/mo or higher) to attach persistent disks and run pre-deploy commands. Free tier instances do not support disks.

1. In the Web Service dashboard, navigate to **Disks** → **Add Disk**.
2. Configure the disk:
   - **Name**: `crm-uploads`
   - **Mount Path**: `/var/data`
   - **Size**: `10 GB` (or larger as required)
3. Ensure the environment variable `UPLOAD_DIR` is set to `/var/data/uploads`.
4. Click **Save Changes**. The service will mount the disk across redeploys and restarts.

---

### Step E: Deploy, Verify Migration Log & Run Smoke Script
**[Only the owner can do this]**

1. Trigger a deploy or push the merged branch to `main`.
2. In the Render Dashboard, click **Logs** and watch the **Pre-Deploy** phase:
   - Verify the pre-deploy migration runs `npm run migrate`.
   - Confirm you see the line:
     ```text
     20261025000000-create-site-inspection-tables: migrated
     ```
     *(If the migration was already applied previously, it will show "No migrations were executed, database schema was already up to date".)*
3. Once the Web Service reaches **Live**, run the smoke script from your local terminal:

```bash
# Basic unauthenticated smoke checks:
./scripts/render-smoke.sh https://<your-service-name>.onrender.com

# Or full authenticated smoke checks with a temporary JWT:
SMOKE_JWT="<your_admin_jwt>" ./scripts/render-smoke.sh https://<your-service-name>.onrender.com
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
8. **Test Persistence Across Restart**:
   - In the Render Dashboard, go to your Web Service and click **Manual Deploy** → **Restart Service**.
   - Once restarted, open the inspection attachments or click Download Photo.
   - Confirm the photo downloads and renders completely, proving persistent disk retention.

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
   - **DO NOT run `npm run migrate-undo`** unless you are prepared to permanently delete all site inspection tables, history, and uploaded records.
   - The migration `20261025000000-create-site-inspection-tables.js` is strictly additive. Leaving the tables in the database is backward-compatible with older backend code and causes no errors.
