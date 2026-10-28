# Site Inspection Technical Audit & Qualification Gate

## 1. Overview & Flow

The Site Inspection gate adds a mandatory technical qualification phase to the commercial sales pipeline:

```text
New  ──►  Contacted  ──►  Site Inspection  ──►  Qualified  ──►  Converted
```

### Lead Lifecycle Rules
1. **Auto-Trigger**: When a Lead transitions to `CONTACTED` (e.g., via outbound phone call, meeting, or manual contact log), a `SiteInspection` record is automatically created in `REQUESTED` status and auto-assigned to an available `site_manager` using round-robin / least-recently-assigned workload distribution.
2. **Qualification Gate**: The Lead **CANNOT** be moved to `Qualified` or `Converted` (via `POST /api/v1/leads/:id/qualify`, `POST /api/v1/leads/:id/convert`, or manual `PUT /api/v1/leads/:id`) until:
   - A Site Manager completes all 3 steps of the technical inspection wizard.
   - At least one active waste disposal stream with an approved facility and distance is configured.
   - At least one ground photo attachment is uploaded.
   - The Site Manager submits the inspection (`SUBMITTED`).
   - An Operations Manager or authorized approver reviews and approves it (`APPROVED`).
3. **Conversion Linkage**: When the Lead is subsequently converted to an Opportunity/Deal, the `dealId` is automatically linked to the `SiteInspection` record for downstream operational tracking.

---

## 2. Roles & Access Control

| Role | Permissions & Scope |
| :--- | :--- |
| `site_manager` | • Sees **only** their own assigned inspections in `/site-inspections` (isolated list).<br>• Root path `/` redirects directly to `/site-inspections`.<br>• Can draft, update, upload attachments, and submit their assigned inspections.<br>• **Strictly forbidden** from approving inspections (including their own). |
| `ops_manager` | • Operations manager role with inspection oversight.<br>• Can review inspections (`APPROVE` or `REQUEST_CHANGES` with a mandatory comment).<br>• Can reassign inspections to other site managers.<br>• Can manage Operations Bases (`SiteBases`) and Disposal Facilities (`SiteFacilities`).<br>• Receives 403 Forbidden on unrelated admin/management routes (e.g., user administration). |
| Approvers (`admin`, `director`, `manager`, `sales_manager`, `ops_manager`) | • Authorized to review, approve, request changes, or reassign inspections.<br>• **Self-approval is forbidden**: An approver who is assigned as the inspector on a record cannot approve their own inspection. |

---

## 3. The Gate & Enforcement Points

The gate is enforced in both backend service logic and controller entrypoints:

1. **`backend/src/services/siteInspectionGate.ts`**:
   - `validateSiteInspectionGate(leadId: string)` checks the lead's associated `SiteInspection`.
   - Gate statuses:
     - `NOT_REQUESTED`: Rejected ("Site inspection has not been requested.")
     - `REQUESTED`: Rejected ("Site inspection has been requested but is not yet drafted.")
     - `DRAFT`: Rejected ("Site inspection is currently in draft.")
     - `SUBMITTED`: Rejected ("Site inspection is submitted and pending management review.")
     - `CHANGES_REQUESTED`: Rejected ("Site inspection has requested changes pending revision.")
     - `APPROVED`: Allowed.
2. **`backend/src/services/leadStageAutomationService.ts`**:
   - `canAdvanceToQualified(lead)` checks the gate before allowing automated stage transitions.
3. **`backend/src/controllers/leadController.ts`**:
   - `qualifyLead`: Evaluates `validateSiteInspectionGate` before updating stage to `Qualified`.
   - `convertLead`: Evaluates `validateSiteInspectionGate` before creating Account, Contact, and Opportunity.
   - `updateLead`: Blocks manual stage modification to `Qualified` or `Converted` if the gate condition is unsatisfied.

---

## 4. Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `SITE_INSPECTION_GATE` | `on` | Set to `off` to bypass gate checks (demos or legacy test suites only). |
| `SITE_INSPECTION_SLA_HOURS` | `48` | Target hours between `REQUESTED` and `SUBMITTED` before flagging overdue. |
| `SITE_INSPECTION_FUEL_L_PER_KM` | `0.40` | Heavy vehicle fuel consumption factor (diesel litres per kilometer). |
| `STORAGE_DRIVER` | `local` | Storage driver: `local` (disk under `UPLOAD_DIR`) or `s3` (S3-compatible object storage). Default is `local`. |
| `UPLOAD_DIR` | `./uploads` | Local directory for attachments when `STORAGE_DRIVER=local`. (On Vercel, use `/tmp/uploads`). |
| `S3_BUCKET` | *(none)* | Bucket name for S3-compatible storage (required when `STORAGE_DRIVER=s3`). |
| `S3_REGION` | `us-east-1` | S3 region or `auto` for Cloudflare R2. |
| `S3_ENDPOINT` | *(none)* | Custom endpoint URL (required for Cloudflare R2 and Supabase Storage S3 endpoints). |
| `S3_ACCESS_KEY_ID` | *(none)* | S3 access key ID. |
| `S3_SECRET_ACCESS_KEY` | *(none)* | S3 secret access key. |
| `S3_FORCE_PATH_STYLE` | `false` | Set to `true` if your S3-compatible provider requires path-style addressing (e.g. MinIO or Supabase). |

---

## 4.1 Object Storage Setup & Bucket Security Checklist

To run securely with `STORAGE_DRIVER=s3`:

1. **Private Bucket**:
   - Bucket must be strictly **private** (block all public read/write access).
   - All browser uploads use 5-minute pre-signed PUT URLs.
   - All downloads use 60-second pre-signed GET URLs generated on-demand by the backend API.
2. **Least-Privilege IAM / Access Credentials**:
   - Scope access credentials strictly to the designated bucket:
     - `s3:PutObject`
     - `s3:GetObject`
     - `s3:DeleteObject`
     - `s3:HeadObject`
3. **CORS Configuration Rule**:
   - The bucket must configure CORS to allow the frontend origin to upload directly:
   ```json
   [
     {
       "AllowedHeaders": ["Content-Type"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedOrigins": ["https://your-crm-frontend.vercel.app", "http://localhost:5173"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### Cloudflare R2 Quick Setup
1. In the Cloudflare Dashboard, navigate to **R2** ➔ **Create Bucket** (e.g., `nexus-site-inspections`).
2. Under **Bucket Settings** ➔ **CORS Policy**, paste the CORS configuration above (replace with your frontend domain).
3. Under **Manage R2 API Tokens**, click **Create API Token**:
   - Permission: *Object Read & Write*
   - Specify bucket: `nexus-site-inspections`
4. Copy credentials to Vercel Environment Variables:
   - `STORAGE_DRIVER=s3`
   - `S3_BUCKET=nexus-site-inspections`
   - `S3_REGION=auto`
   - `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>`
   - `S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>`

### Supabase Storage (S3 Protocol) Quick Setup
1. In your Supabase project dashboard, navigate to **Storage** ➔ **New Bucket**:
   - Name: `nexus-site-inspections`
   - Public: **OFF** (Keep private).
2. Go to **Project Settings** ➔ **Storage** ➔ **S3 Access Keys**:
   - Generate a new S3 Access Key ID and Secret Key.
3. Configure CORS on the Supabase bucket settings for your frontend origin.
4. Copy credentials to Vercel Environment Variables:
   - `STORAGE_DRIVER=s3`
   - `S3_BUCKET=nexus-site-inspections`
   - `S3_REGION=<project-region>` (e.g., `us-east-1` or your Supabase region)
   - `S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3`
   - `S3_ACCESS_KEY_ID=<ACCESS_KEY_ID>`
   - `S3_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>`
   - `S3_FORCE_PATH_STYLE=true`

---

## 5. Transport Calculations & Formulas

### Straight-Line Distance ($D_{\text{straight}}$)
Calculated via the Haversine formula between the Operations Base $(\text{lat}_1, \text{lon}_1)$ and the Client Site $(\text{lat}_2, \text{lon}_2)$ and rounded to 0.1 km:

$$\Delta\sigma = 2 \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
$$D_{\text{straight}} = R \cdot \Delta\sigma \quad (R = 6371.0\text{ km})$$

### Road Estimate
The UI provides a one-click road estimation button:

$$D_{\text{road estimate}} = \text{round}(D_{\text{straight}} \times 1.3)$$

### Total Cycle Distance ($KM_{\text{cycle}}$)
Mobilization is round-trip between the base and site ($2 \times M$), plus round-trip haulage to each active waste disposal facility ($2 \times D_i$):

$$KM_{\text{cycle}} = 2 \times \left(M + \sum_{i \in \text{Active Scopes}} D_i\right)$$

*Example*: Base mobilization of 45 km + 1 hazardous waste facility at 38 km:
$$KM_{\text{cycle}} = 2 \times (45 + 38) = 166.0\text{ km}$$

### Estimated Diesel Fuel Consumption ($L_{\text{fuel}}$)

$$L_{\text{fuel}} = KM_{\text{cycle}} \times \text{SITE\_INSPECTION\_FUEL\_L\_PER\_KM}$$

*Example* (at default 0.40 L/km):
$$166.0\text{ km} \times 0.40 = 66.4\text{ L}$$

---

## 6. How to Create a Site Manager User

### Via Node CLI / Sequelize Script
```javascript
const bcrypt = require("bcryptjs");
const { User, Database } = require("@nexus-crm/database");

async function createSiteManager() {
  await Database.createConnection();
  const hash = await bcrypt.hash("SecurePassword123!", 10);
  
  const user = await User.create({
    name: "Hassan Al-Zahrani",
    email: "hassan.zahrani@nexus.com",
    password: hash,
    role: "site_manager",
    isAvailable: true,
    maxOpenLeads: 25,
  });
  console.log("Created site manager:", user.id);
}
createSiteManager();
```

### Via Direct SQL (PostgreSQL)
```sql
-- Ensure password hash generated with bcrypt (10 rounds)
INSERT INTO "Users" (
  "id", "name", "email", "password", "role", "isAvailable", "maxOpenLeads", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Hassan Al-Zahrani',
  'hassan.zahrani@nexus.com',
  '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', -- bcrypt hash
  'site_manager',
  true,
  25,
  NOW(),
  NOW()
);
```

---

## 7. Production Deployment & Operational Notes

### Deployment Checklist
1. **Database Backup**: Take a complete snapshot / backup of the production database prior to running migrations.
2. **Execute Migrations**: Run `npm run migrate` to apply migration `20261025000000-create-site-inspection-tables.js`. This creates `SiteBases`, `SiteFacilities`, `SiteInspections`, `SiteInspectionServices`, `SiteInspectionAttachments`, extends `Leads` with `siteInspectionStatus` and `siteInspectionId`, and updates PostgreSQL enums.
3. **Persistent Upload Storage**: Ensure `UPLOAD_DIR` points to a persistent network volume, persistent disk, or container volume mount. Photos and inspection attachments are stored on the local file system.
4. **Seed Required Roles**: Create at least one user with role `site_manager` and at least one user with role `ops_manager`.
5. **Verify Base Locations**: Confirm the 4 pre-seeded operations base locations in `SiteBases`:
   - `JUBAIL`: Jubail Operations Base ($27.0000^\circ\text{ N}, 49.6500^\circ\text{ E}$)
   - `JAFURAH`: Jafurah Operations Base ($25.5500^\circ\text{ N}, 49.8500^\circ\text{ E}$)
   - `YANBU`: Yanbu Operations Base ($24.0890^\circ\text{ N}, 38.0630^\circ\text{ E}$)
   - `RIYADH`: Central Riyadh Logistics Hub ($24.7136^\circ\text{ N}, 46.6753^\circ\text{ E}$)
6. **Production Gate Configuration**: Keep `SITE_INSPECTION_GATE=on` in production. Only set `SITE_INSPECTION_GATE=off` for temporary staging demos or legacy unit test suites.

### Rollback Strategy
- **Immediate Disablement**: Set `SITE_INSPECTION_GATE=off` in environment variables and restart the backend. All qualification and conversion requests will immediately bypass the site inspection check without schema changes.
- **Full Database Reversion**: Running `npx sequelize-cli db:migrate:undo` reverts `20261025000000-create-site-inspection-tables.js`, dropping the 5 inspection tables and the 2 added columns on `Leads`.

### Known Limitations
- **Storage Backend**: Attachments are stored on the local disk filesystem via Multer (`UPLOAD_DIR`). Direct Amazon S3 / Cloudflare R2 object storage integration is not included in this release and is planned for a future update.
- **Migration Cleanliness**: SQLite-compatibility polyfills for historical migrations dated before 2026-10-25 are isolated on the separate branch `chore/sqlite-migration-compat` and are not included in this PR.
