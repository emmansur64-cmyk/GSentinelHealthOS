# GSentinelHealth OS

Clinical Scheduling & Patient Flow System.

Production-ready monorepo scaffold with:

- Frontend: React + Vite + TailwindCSS + React Query + Zustand + React Router
- Backend: Node.js + Express + Prisma + PostgreSQL
- Packages: Shared UI package
- Infra: Docker + Docker Compose

## Repository Structure

```txt
gsentinelhealth-os/
├── apps/
│   ├── frontend/
│   └── backend/
├── packages/
│   └── ui/
├── docker-compose.yml
└── README.md
```

## Quick Start (Local)

1. Copy env vars:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start PostgreSQL (Docker):

```bash
docker compose up -d postgres
```

4. Generate Prisma client and run migration:

```bash
npm run db:generate
npm run db:migrate
```

5. Start apps:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health check: http://localhost:4000/health

## Full Docker Run

```bash
docker compose up --build
```

## Useful Scripts

- `npm run dev`
- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run build`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:studio`

## Backend Architecture (Layered)

```txt
apps/backend/src/
├── controllers/
├── services/
├── routes/
├── validators/
├── middleware/
└── lib/
```

## Backend Endpoints

- `POST /auth/login`
- `GET /appointments`
- `POST /appointments`
- `PATCH /appointments/:id`
- `DELETE /appointments/:id`
- `GET /stats/today`
- `GET /settings`
- `POST /settings`

Also exposed under `/api/*` for compatibility (example: `/api/appointments`).
