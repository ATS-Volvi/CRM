# Inbound Email Routing Integration Checklist (Model A)

This document outlines the step-by-step setup procedure required to route incoming salesperson emails into the Nexus Sales CRM.

## Phase 1 — Domain and DNS Setup
1. **Acquire Company Domain**:
   - Confirm you own and control the target company email domain (e.g. `yourdomain.com`).
2. **Setup Provider Account**:
   - Create an account on your chosen email parser service (e.g. **SendGrid**).
3. **Verify Domain Domain Authentication**:
   - Follow the SendGrid Domain Authentication setup to add the required `CNAME` records to your DNS provider (e.g. Cloudflare, Route53, GoDaddy) to authenticate sending and receiving.
4. **Configure MX Records**:
   - In your domain DNS manager, add a new **MX Record** pointing your receiving domain or subdomain (e.g., `@` or `mx.yourdomain.com`) to the provider's inbound mail servers:
     - Name/Host: `@` (or `mx`)
     - Type: `MX`
     - Value: `mx.sendgrid.net.`
     - Priority: `10`
5. **Verify Propagation**:
   - Confirm records have propagated using command line diagnostics:
     ```bash
     dig MX yourdomain.com
     ```

---

## Phase 2 — Webhook Configuration & Security Hardening
1. **Define Security Secret Key**:
   - Generate a strong, secure token to authenticate incoming parse hook requests (e.g. `INBOUND_EMAIL_SECRET=your_secret_token_here`).
2. **Add Environment Variable**:
   - Log into your Render/hosting environment dashboard.
   - Set the `INBOUND_EMAIL_SECRET` variable under **Environment Settings** matching your generated secret token.
3. **Setup Inbound Parse Route**:
   - In the SendGrid dashboard, navigate to **Settings > Inbound Parse**.
   - Click **Add Host & URL**.
   - Configure the following fields:
     - **Host**: `yourdomain.com`
     - **Destination URL**: `https://crm-k8g4.onrender.com/api/v1/emails/inbound?auth_token=your_secret_token_here` (replace `your_secret_token_here` with the token matching your `INBOUND_EMAIL_SECRET`).
   - Check the **"Raw"** option if you wish SendGrid to post the full raw SMTP envelope payloads.

---

## Phase 3 — Database User Migration
1. **Backup Production Database**:
   - Always export a database backup before performing schema or record migrations.
2. **Perform Dry-Run Migration**:
   - Run the domain migration script in dry-run mode from the backend folder to verify matches:
     ```bash
     npx ts-node scripts/updateUserDomain.ts nexus.com yourdomain.com --dry-run
     ```
3. **Execute Migration**:
   - Once verified, execute the migration to update the email domain suffix of all salespeople records:
     ```bash
     npx ts-node scripts/updateUserDomain.ts nexus.com yourdomain.com
     ```

---

## Phase 4 — E2E Testing & Validation
1. **Send Real Test Email**:
   - Send an email from an external client (e.g. your personal Gmail account) addressed to a salesperson on your new domain:
     - To: `liam@yourdomain.com`
     - Subject: `Interested in quote`
     - Body: `Hi Liam, I need pricing information.`
2. **Verify Assignment**:
   - Log in to the CRM frontend and confirm that the new lead appears under **Leads Inbox** or **My Dashboard** correctly assigned to Liam Carter.
3. **Rollback Procedures**:
   - If routing issues arise or leads fail to ingest, immediately remove the Inbound Parse Route configuration in your SendGrid dashboard or repoint the MX record to disable routing.
