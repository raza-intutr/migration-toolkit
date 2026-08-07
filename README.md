# Offline Tool

A multi-tenant PostgreSQL migration tool with a React frontend and an Express/Prisma backend. Tenants are registered per environment, and a tenant database can be migrated from one environment to another via `pg_dump` → `pg_restore`.

## Stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | React 19, Vite, TanStack Router + Query, Tailwind CSS v4 |
| Backend  | Node.js 22, Express 5 (ESM), Prisma 7, PostgreSQL |
| Infra    | Docker Compose, nginx |

## Project structure

```
├── backend/            # Express API (:3000)
│   ├── prisma/         # schema, migrations, seed
│   └── src/            # routes → controllers → services → prisma
├── frontend/           # Vite + React SPA (:3030)
├── docker-compose.yml  # backend + frontend (nginx)
└── setup.sh            # one-shot fresh-machine setup
```

## Quick start

### One-shot script

```bash
./setup.sh              # installs everything, then runs docker compose up --build -d
./setup.sh --local      # run local pnpm dev servers in the foreground (Ctrl+C to stop)
./setup.sh --skip-db    # skip database provisioning
```

The default finishes by starting backend + frontend via Docker Compose **detached**, so they keep running after the setup terminal is closed. Stop them with `docker compose down`.

### Manually

```bash
# Backend (port 3000)
cd backend
cp .env.example .env    # set DATABASE_URL, JWT_SECRET, CLIENT_URL
pnpm install
pnpm prisma:generate
pnpm prisma:migrate     # prisma migrate dev
pnpm exec node prisma/seed.js
pnpm dev

# Frontend (port 3030)
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3000/api/v1
pnpm install
pnpm dev
```

### Docker Compose

```bash
docker compose up --build -d
```

Frontend is served by nginx at `http://localhost:3030`; `/api/` is proxied to the backend.

## Ports

| Service  | Local dev | Docker |
| -------- | --------- | ------ |
| Backend  | 3000      | 3000   |
| Frontend | 3030      | 3030   |

## Login

The seed script creates:

```
admin@example.com / password123
```

## API docs

Interactive OpenAPI reference (Scalar): `http://localhost:3000/api/v1/docs`

## Notes

- **Frontend CORS**: `CLIENT_URL` in `backend/.env` must match the frontend origin (`http://localhost:3030` for local dev; Docker Compose overrides it).
- **Migrations**: overwrite is disabled in the UI; the backend returns `409 TARGET_HAS_DATA` if the target tenant database already contains tables and `confirm_overwrite` is not `true`.
- **Dumps**: `pg_dump` output is written to `backend/dumps/` (inside the container when running via Docker, so it is ephemeral).
