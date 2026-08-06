#!/usr/bin/env bash
set -euo pipefail

# Offline Tool - one-shot setup for a fresh machine.
# After installing everything it starts backend + frontend via docker compose
# (detached), so they keep running after this terminal is closed.
# Usage: ./setup.sh [--skip-db] [--local]

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
DB_PLACEHOLDER='user:password@localhost:5432/mydb'

BACKEND_PORT=3000
FRONTEND_PORT=3030
DOCKER_FRONTEND_PORT=3030

SKIP_DB=0
LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=1 ;;
    --local) LOCAL=1 ;;
    -h|--help)
      echo "Usage: ./setup.sh [--skip-db] [--local]"
      echo "  --skip-db  skip database provisioning (backend will start but DB features fail)"
      echo "  --local    run local pnpm dev servers in the foreground"
      echo "             (Ctrl+C stops both and frees the ports)"
      echo
      echo "Default: install everything, then run docker compose up --build -d"
      echo "         backend :3000, frontend :3030 - survive terminal close"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { printf "${GREEN}[setup]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[setup]${NC} %s\n" "$*"; }
err()   { printf "${RED}[setup]${NC} %s\n" "$*" >&2; }
step()  { printf "\n${GREEN}==>${NC} %s\n" "$*"; }

fail() { err "$*"; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

ensure_node() {
  step "Checking prerequisites"
  command_exists node || fail "Node.js is not installed. Install Node 18+ first: https://nodejs.org"
  NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
  [ "$NODE_MAJOR" -ge 18 ] || fail "Node $NODE_MAJOR detected; Node 18+ is required."

  if ! command_exists pnpm; then
    warn "pnpm not found - installing pnpm@9.12.0 (pinned by the repo)"
    if command_exists corepack; then
      corepack enable
      corepack prepare pnpm@9.12.0 --activate
    elif command_exists npm; then
      npm install -g pnpm@9.12.0
    else
      fail "Neither pnpm, corepack, nor npm is available."
    fi
  fi
  PNPM_VERSION="$(pnpm -v 2>/dev/null | head -n1 || true)"
  info "node $(node -v), pnpm ${PNPM_VERSION:-?}"
}

copy_env() {
  local dir="$1"
  if [ -f "$dir/.env" ]; then
    info "$(basename "$dir"): .env already exists, keeping it"
  else
    cp "$dir/.env.example" "$dir/.env"
    info "$(basename "$dir"): created .env from .env.example"
  fi
}

install_deps() {
  step "Installing backend dependencies"
  (cd "$BACKEND" && pnpm install --frozen-lockfile=false)
  step "Installing frontend dependencies"
  (cd "$FRONTEND" && pnpm install --frozen-lockfile=false)
}

get_env() {
  local file="$1" key="$2"
  grep -E "^$key=" "$file" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"' || true
}

set_env() {
  local file="$1" key="$2" value="$3"
  if grep -qE "^$key=" "$file"; then
    sed -i.bak "s|^$key=.*|$key=\"$value\"|" "$file" && rm -f "$file.bak"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$file"
  fi
}

ensure_client_url() {
  local current
  current="$(get_env "$BACKEND/.env" CLIENT_URL)"
  if [ "$current" != "http://localhost:$FRONTEND_PORT" ]; then
    set_env "$BACKEND/.env" CLIENT_URL "http://localhost:$FRONTEND_PORT"
    info "Set CLIENT_URL to http://localhost:$FRONTEND_PORT (frontend dev server, CORS)"
  fi
}

ensure_database_url() {
  local current
  current="$(get_env "$BACKEND/.env" DATABASE_URL)"
  if [ -n "$current" ] && [ "$current" != "$DB_PLACEHOLDER" ]; then
    info "Using DATABASE_URL already present in backend/.env"
    return
  fi

  echo
  warn "No usable DATABASE_URL found."
  echo "How do you want to provision the PostgreSQL database?"
  echo "  1) Start a local Postgres in Docker (recommended)"
  echo "  2) Paste an existing DATABASE_URL (e.g. Neon/RDS/Supabase)"
  echo "  3) Skip database setup"
  printf "Choice [1/2/3]: "
  read -r choice </dev/tty
  case "$choice" in
    1)
      command_exists docker || fail "Docker is not installed. Install Docker first: https://docker.com"
      docker info >/dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
      start_local_postgres
      ;;
    2)
      printf "Paste DATABASE_URL: "
      read -r url </dev/tty
      [ -n "$url" ] || fail "Empty DATABASE_URL."
      set_env "$BACKEND/.env" DATABASE_URL "$url"
      info "DATABASE_URL written to backend/.env"
      ;;
    3|*)
      SKIP_DB=1
      warn "Skipping database setup."
      ;;
  esac
}

start_local_postgres() {
  local container="offline-tool-pg" user="postgres" pass="postgres" db="offline_tool" port=5432
  if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
    warn "Container '$container' already exists - starting it"
    docker start "$container" >/dev/null
  else
    info "Starting local Postgres container '$container' on port $port"
    docker run -d --name "$container" \
      -e POSTGRES_USER="$user" -e POSTGRES_PASSWORD="$pass" -e POSTGRES_DB="$db" \
      -p "$port:5432" postgres:16-alpine >/dev/null
  fi

  info "Waiting for Postgres to accept connections..."
  for _ in $(seq 1 30); do
    if docker exec "$container" pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec "$container" pg_isready -U "$user" -d "$db" >/dev/null 2>&1 \
    || fail "Postgres did not become ready in time."

  set_env "$BACKEND/.env" DATABASE_URL "postgresql://$user:$pass@localhost:$port/$db?schema=public"
  info "DATABASE_URL written to backend/.env"
}

run_prisma() {
  step "Setting up the database schema"
  (cd "$BACKEND" && pnpm prisma:generate)
  (cd "$BACKEND" && pnpm exec prisma migrate deploy)
  info "Migrations applied"
  step "Seeding database (creates admin@example.com / password123)"
  (cd "$BACKEND" && pnpm exec node prisma/seed.js)
}

run_dev() {
  step "Starting backend + frontend dev servers"
  info "Backend:  http://localhost:$BACKEND_PORT/api/v1"
  info "Frontend: http://localhost:$FRONTEND_PORT"
  info "Press Ctrl+C to stop both and free the ports."

  (cd "$BACKEND" && pnpm dev) & BACK_PID=$!
  (cd "$FRONTEND" && pnpm dev) & FRONT_PID=$!

  cleanup() {
    kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
    wait "$BACK_PID" 2>/dev/null || true
    wait "$FRONT_PID" 2>/dev/null || true
    info "Dev servers stopped - ports freed."
  }
  trap cleanup INT TERM EXIT

  wait "$BACK_PID"
  wait "$FRONT_PID"
}

run_docker() {
  step "Starting backend + frontend via docker compose (detached)"
  command_exists docker || fail "Docker is not installed. Install Docker first: https://docker.com"
  docker info >/dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."

  (cd "$ROOT" && docker compose up --build -d)

  info "Waiting for backend health check..."
  for _ in $(seq 1 60); do
    if curl -fsS "http://localhost:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  curl -fsS "http://localhost:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1 \
    || warn "Backend did not become ready in time - check: docker compose logs backend"
}

main() {
  info "Offline Tool setup started (root: $ROOT)"
  ensure_node
  copy_env "$BACKEND"
  copy_env "$FRONTEND"
  install_deps
  ensure_client_url

  if [ "$SKIP_DB" -eq 0 ]; then
    ensure_database_url
  fi

  if [ "$SKIP_DB" -eq 0 ]; then
    run_prisma
  else
    step "Running prisma generate only (db skipped)"
    (cd "$BACKEND" && pnpm prisma:generate)
  fi

  step "Setup complete"
  echo "  Login: admin@example.com / password123"

  if [ "$LOCAL" -eq 1 ]; then
    run_dev
    info "Backend:  http://localhost:$BACKEND_PORT/api/v1"
    info "Frontend: http://localhost:$FRONTEND_PORT"
  else
    run_docker
    info "Backend:  http://localhost:$BACKEND_PORT/api/v1"
    info "Frontend: http://localhost:$DOCKER_FRONTEND_PORT"
    info "API docs: http://localhost:$BACKEND_PORT/api/v1/docs"
    info "Logs:     docker compose logs -f"
    info "Containers keep running after this terminal closes. Stop with: docker compose down"
  fi
}

main "$@"
