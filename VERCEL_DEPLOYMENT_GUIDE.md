# 🚀 Deploying Nexus CRM on Vercel (100% Unified Serverless)

This repository is configured to deploy both the **React Frontend (SPA)** and **Express Backend API** with **Background Schedulers (Vercel Cron)** on **Vercel**.

---

## 1. Prerequisites: Cloud PostgreSQL Database

Because Vercel functions are stateless and ephemeral, SQLite cannot be used for persistent data. You need a hosted PostgreSQL database.

**Recommended Free Cloud Database Providers:**
- **[Neon Postgres](https://neon.tech)** (Recommended: Free serverless Postgres with instant branching & connection pooling)
- **[Supabase](https://supabase.com)** (Free hosted PostgreSQL)
- **[Railway Postgres](https://railway.app)** or **[Aiven](https://aiven.io)**

> Save your connection string (e.g. `postgresql://username:password@ep-xyz.neon.tech/neondb?sslmode=require`).

---

## 2. Setting Up Environment Variables in Vercel

When importing your project into Vercel, navigate to **Project Settings > Environment Variables** and add:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL Connection URI | `postgresql://user:pass@ep-cool-pool.neon.tech/nexus?sslmode=require` |
| `JWT_SECRET` | Secret key for signing session tokens | `your-secure-random-jwt-secret-string` |
| `NODE_ENV` | Environment mode | `production` |
| `CRON_SECRET` | Secret key securing Vercel Cron jobs | `your-random-cron-secret-token` |
| `PORT` | Fallback port | `5506` |
| `CORS_ORIGIN` | Allowed CORS origins (optional) | `https://your-crm-domain.vercel.app` |

*(Optional Integrations: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, etc.)*

---

## 3. How to Deploy to Vercel

### Method A: Deploy via Vercel Web Dashboard (Easiest)
1. Push your CRM code to a GitHub repository:
   ```bash
   git add .
   git commit -m "Configure 100% Vercel serverless deployment"
   git push origin main
   ```
2. Open [vercel.com/new](https://vercel.com/new).
3. Import your GitHub repository.
4. Leave **Framework Preset** as **Other** (or **Vite**). Vercel reads `vercel.json` automatically:
   - **Build Command:** `npm run build`
   - **Output Directory:** `frontend/dist`
   - **Install Command:** `npm install`
5. Expand **Environment Variables** and paste the variables listed above.
6. Click **Deploy**.

### Method B: Deploy via Vercel CLI
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login and deploy
vercel
vercel --prod
```

---

## 4. Initial Database Migration & Seeding

Before your first login, initialize the PostgreSQL schema and seed default master data.

From your local machine (with your remote `DATABASE_URL` configured in `backend/.env`):
```bash
# 1. Run migrations against your cloud DB
npm run migrate

# 2. Seed initial admin users, salesperson data, and mock catalog
npm run seed
```

---

## 5. Automated Schedulers & Cron Jobs

On Vercel, traditional background intervals (`setInterval`) are replaced by **Vercel Cron Jobs** configured in `vercel.json`:

- **Hourly Cron (`/api/v1/cron/hourly`):**
  - Runs overdue task sweeps
  - Sends scheduled automated emails & quote follow-ups
  - Polls lead connectors (Gmail, Meta, LinkedIn)
- **Daily Cron (`/api/v1/cron/daily`):**
  - Automatically marks expired quotes
  - Escalates unattended approval requests (>24h) to directors
  - Flags deals missing purchase orders
  - Generates daily salesperson task digests
  - Performs daily lead temperature decay sweep
  - Generates weekly management executive summary on Mondays

---

## 6. Architecture Overview

```mermaid
graph TD
    Client[Browser / User] -->|Requests| VercelEdge[Vercel Edge Network]
    VercelEdge -->|/api/*| ServerlessFunc[api/index.ts Serverless Function]
    VercelEdge -->|/* (SPA)| StaticAssets[frontend/dist Static SPA]
    VercelCron[Vercel Cron Service] -->|Hourly / Daily Triggers| ServerlessFunc
    ServerlessFunc -->|Sequelize Pool| CloudPostgres[(Neon / Supabase Postgres)]
```
