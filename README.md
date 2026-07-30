# Nexus Sales CRM

Sales CRM app — leads, pipeline, quotes, approvals, KPIs — scaffolded with the same stack as `prline2`.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **Backend:** Node.js + Express + TypeScript + Sequelize
- **Database:** PostgreSQL
- **Hosting:** Frontend on Vercel, backend on Railway

## Structure
```
nexus-sales-crm/
├── frontend/          # React + Vite app
├── backend/           # Express + TypeScript API
├── database/          # Shared Sequelize models/migrations (@nexus-crm/database)
├── design-reference/  # Stitch-generated static HTML mockups (leads, pipeline, quotes, approvals, KPIs)
├── railway.toml       # Backend deploy config
└── vercel.json        # Frontend deploy config
```

## Getting Started
```bash
npm install
cp backend/.env.example backend/.env   # fill in DB creds / JWT secret
# If targeting Postgres, run database migrations:
npm run migrate --workspace=backend
npm run dev:backend                    # starts API on :5505
npm run dev:frontend                   # starts Vite dev server on :5173
```

> [!IMPORTANT]
> Database schema updates on Postgres must only be performed via migrations (`npm run migrate --workspace=backend`). The automatic `sequelize.sync({ alter: true })` call is disabled by default. For local dev convenience, it can be explicitly enabled with `RUN_SYNC=true` in your environment.

## WhatsApp Integration (Twilio Sandbox)

Nexus CRM uses **Twilio Programmable Messaging / WhatsApp API** for real-time lead and customer communication.

> [!NOTE]
> **Development & Testing Setup (Twilio Sandbox)**:
> 1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_NUMBER` in `backend/.env`.
> 2. Anyone testing inbound/outbound messaging must first send `join <your-sandbox-code>` from their mobile WhatsApp to the Twilio Sandbox number (`+1 415 523 8886`) once to join the sandbox session.
> 3. Configure your Twilio WhatsApp Sandbox webhook to point to `https://<your-ngrok-domain>/api/v1/whatsapp/webhook` (`HTTP POST`).

> [!IMPORTANT]
> **Production Deployment Warning**:
> Twilio Sandbox setup is strictly for development and internal testing — it is **not customer-facing**. Moving to production customer use requires either:
> - Registering a Twilio-brokered **Production WhatsApp Sender** (requires Meta Business Verification through Twilio), OR
> - Switching back to direct Meta Cloud API once Meta Business Verification is completed.

