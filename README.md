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
npm run dev:backend                    # starts API on :5505
npm run dev:frontend                   # starts Vite dev server on :5173
```

## Design Reference
The `design-reference/` folder contains static HTML/CSS mockups (Stitch "Horizon Enterprise" design system) for each screen: lead inbox, lead detail, pipeline kanban, quotation builder, price book, purchase orders, approval queue, KPI dashboards, management dashboards, assignment rules. Use these as the visual spec when building out `frontend/src` components/pages. The color palette and typography from `horizon_enterprise/DESIGN.md` are already wired into `frontend/tailwind.config.js`.
