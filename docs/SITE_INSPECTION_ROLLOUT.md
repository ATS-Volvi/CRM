# Site Inspection Feature & Object Storage Rollout Runbook

This runbook outlines the step-by-step procedure for safely deploying the Site Inspection feature and cloud object storage adapter into production.

---

### Step 1: Back up the Production Database `[User Only]`
*Take a complete SQL snapshot before applying any migrations.*
```bash
# Securely read your production database URL into PROD_DB (never hard-code or commit secrets)
# For zsh (macOS default):
read -s "PROD_DB?Enter production database URL: "
echo
export PROD_DB
# (Note for bash users: read -s -p "Enter production database URL: " PROD_DB; echo; export PROD_DB)

# Run pg_dump excluding ownership and privilege statements for portability
pg_dump "$PROD_DB" --no-owner --no-acl > prod_backup_before_site_inspection_$(date +%Y%m%d_%H%M%S).sql

# Verify the backup file was created and is non-empty
test -s prod_backup_before_site_inspection_*.sql && echo "Backup verified: $(ls -lh prod_backup_before_site_inspection_*.sql)"

# Unset variable
unset PROD_DB
```

---

### Step 2: Run the Site Inspection Migration `[User Only]`
*Execute the migration against the production database using a direct connection.*
```bash
# Checkout main and ensure latest commits
git checkout main
git pull origin main

# For zsh (macOS default):
read -s "PROD_DB?Enter production database URL: "
echo
export PROD_DB
# (Note for bash users: read -s -p "Enter production database URL: " PROD_DB; echo; export PROD_DB)

# Run migration
DATABASE_URL="$PROD_DB" USE_SQLITE="false" NODE_ENV="production" npx sequelize-cli db:migrate

# Expected Output:
# == 20261025000000-create-site-inspection-tables: migrating =======
# == 20261025000000-create-site-inspection-tables: migrated (0.412s)

# Verify with read-only psql queries:
psql "$PROD_DB" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('SiteBases', 'SiteFacilities', 'SiteInspections', 'SiteInspectionServices', 'SiteInspectionAttachments') ORDER BY table_name;"
psql "$PROD_DB" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Leads' AND column_name IN ('siteInspectionStatus', 'siteInspectionId');"
psql "$PROD_DB" -c "SELECT code, name, region FROM \"SiteBases\";"

unset PROD_DB
```

---

### Step 3: Keep Gate Disabled During Rollout `[User Only]`
In the Vercel Dashboard (**Settings ➔ Environment Variables**):
- Add `SITE_INSPECTION_GATE` with value `off` across **Production** and **Preview**.
- This ensures existing sales pipeline workflows and lead qualification are not blocked while configuration and testing take place.

---

### Step 4: Create Test Site Manager and Ops Manager Users `[User Only]`
1. Open the CRM web dashboard as an Administrator.
2. In the navigation sidebar, go to **Salesperson Tracker** (`/salespersons`).
3. Click **Add Salesperson** (or **New User**).
4. Create user 1 with Role: `Site Manager` (`site_manager`).
5. Create user 2 with Role: `Operations Manager` (`ops_manager`).

---

### Step 5: Create Storage Bucket, Access Keys & Configure Preview `[User Only]`
1. Follow [docs/SITE_INSPECTION_STORAGE_SETUP.md](file:///Users/saud/Projects/CRM/docs/SITE_INSPECTION_STORAGE_SETUP.md) to:
   - Create a private bucket in Cloudflare R2, AWS S3, or Supabase Storage.
   - Configure CORS allowing `PUT` and `GET` from your Vercel Preview domain.
   - Generate least-privilege access keys.
2. In Vercel Project Settings ➔ Environment Variables, add the storage variables to the **Preview** environment:
   - `STORAGE_DRIVER`: `s3`
   - `S3_BUCKET`
   - `S3_REGION`
   - `S3_ENDPOINT`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_FORCE_PATH_STYLE` (if using Supabase)
3. Redeploy the Preview deployment.
4. Run the automated smoke test script on your preview deployment:
   ```bash
   BASE_URL="https://your-preview-deployment.vercel.app" SITE_MANAGER_JWT="<jwt>" ./scripts/site-inspection-storage-smoke.sh <TEST_INSPECTION_ID>
   ```
5. Test a direct upload from a physical smartphone using a real photo > 4.5 MB on the preview form to verify that the Vercel edge body size limit is bypassed and GPS metadata appears.

---

### Step 6: Merge PR #38 & Configure Production Storage `[User Only]`
1. Merge PR #38 into `main`.
2. In Vercel Dashboard ➔ Environment Variables:
   - Add the CORS rule for your production frontend domain (`https://your-production-domain.com`).
   - Add the storage environment variables from Step 5 to the **Production** environment.
3. Trigger a **Production Redeploy** in Vercel.

---

### Step 7: End-to-End Production Verification Lead `[User Only]`
1. Create a test lead in the CRM or move an existing test lead to `CONTACTED`.
2. Confirm the Site Inspection is auto-created in `REQUESTED` status and assigned to your test site manager.
3. Log in as the test site manager:
   - Complete Step 1 (Site & Mobilization), Step 2 (Waste Streams), and Step 3 (Upload photo > 4.5 MB).
   - Click **Submit Inspection**.
4. Log in as the test operations manager:
   - Review and **Approve** the inspection.
5. Qualify and Convert the lead to an Opportunity.
6. Refresh the page the following day to confirm that the attachment image URL and preview remain valid and persistent.

---

### Step 8: Enable Enforcement Gate `[User Only]`
1. In Vercel Project Settings ➔ Environment Variables:
   - Remove `SITE_INSPECTION_GATE` or set its value to `on`.
2. Redeploy the application.
3. The qualification gate is now active across all leads.

---

### Step 9: Emergency Rollback Procedure `[User Only]`
If any operational issue arises, execute the following steps in order:

1. **Feature Gate Disarm (Immediate, Zero Downtime)**:
   - In Vercel Environment Variables, set `SITE_INSPECTION_GATE=off` and redeploy.
   - Lead qualification and conversion proceed unblocked.
2. **Storage Driver Fallback**:
   - If object storage credentials, network, or CORS fail, set `STORAGE_DRIVER=local` in Vercel Environment Variables and redeploy.
   - Uploads revert to temporary local disk storage.
3. **Database Migration Undo (Last Resort Only)**:
   > [!CAUTION]
   > Undoing the database migration drops the 5 site inspection tables and deletes all recorded inspection data. Use only if a severe schema defect is detected before production usage.
   ```bash
   # For zsh (macOS default):
   read -s "PROD_DB?Enter production database URL: "
   echo
   export PROD_DB
   # (Note for bash users: read -s -p "Enter production database URL: " PROD_DB; echo; export PROD_DB)

   DATABASE_URL="$PROD_DB" USE_SQLITE="false" NODE_ENV="production" npx sequelize-cli db:migrate:undo
   unset PROD_DB
   ```
