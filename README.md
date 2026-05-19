# PentestReportMaker — USF CyberHerd Engagement Tracker

Self-hosted web app to **track a pentest/red-team engagement while it happens**
— hosts, compromised users, access paths, artifacts — and capture
report-shaped notes so the eventual report is assembly, not authorship.

Built for the USF CyberHerd. Phase 1 (this build) = tracking + structured
notes. Report rendering is phase 2; a versioned JSON export endpoint is the
designed contract.

## Stack

- **Backend:** FastAPI + async SQLAlchemy 2.0 + PostgreSQL + Alembic
- **Frontend:** React + TypeScript + Vite + Mantine + Cytoscape.js
- **Realtime:** WebSocket (per-engagement broadcast)
- **Deploy:** Docker Compose (web + api + db), offline-capable

## Quick start

```bash
cp .env.example .env        # then edit secrets (see below)
docker compose up --build
# open http://localhost:8080
```

Generate strong secrets for `.env`:

```bash
python -c "import secrets;print(secrets.token_urlsafe(48))"   # SESSION_SECRET
python -c "import secrets;print(secrets.token_urlsafe(32))"   # APP_SECRET_KEY
```

> **`APP_SECRET_KEY` encrypts stored credentials/secrets at rest (AES-GCM).**
> Changing it makes previously stored secrets unrecoverable. Back it up
> securely; key rotation is a manual re-encrypt (documented in M8).

## Run without Docker (verified)

Two processes, no Postgres needed (SQLite):

```bash
# 1) backend
cd backend
export DATABASE_URL="sqlite+aiosqlite:///$PWD/../data/app.sqlite"
export SESSION_SECRET=dev-session APP_SECRET_KEY=dev-appkey
export EVIDENCE_DIR="$PWD/../data/evidence" CORS_ORIGINS=http://localhost:5173
mkdir -p ../data/evidence
python -m alembic upgrade head
python -m app.seed                       # optional: admin / changeme123
python -m uvicorn app.main:app --port 8000

# 2) frontend (Vite proxies /api and /ws to :8000)
cd frontend && npm install && npm run dev
# open http://localhost:5173
```

## Local backend dev (without Docker)

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
# point DATABASE_URL at a local Postgres, then:
alembic upgrade head
uvicorn app.main:app --reload
pytest
```

Frontend dev needs Node 22+ (`cd frontend && npm install && npm run dev`).
If Node isn't installed locally, use the Docker workflow above.

## Sample data (optional)

```bash
# inside the api container (or a local backend venv)
python -m app.seed
```

Creates an idempotent `admin` / `changeme123` and a demo engagement so a
fresh deploy isn't a blank screen. **Change that password immediately.**

## Export contract (phase-2 report seam)

`GET /api/engagements/{id}/export` returns a single versioned JSON document —
the stable interface a future report generator consumes without touching the
DB. Current `schema_version: "1.0"`:

| Key | Contents |
|-----|----------|
| `schema_version` | `"1.0"` — bump on breaking shape changes |
| `engagement` | metadata, scope_md, roe_md |
| `workstreams` | areas + assignees |
| `members` | operators + roles |
| `assets` | hosts incl. `state`, tags, services |
| `compromised_users` | captured accounts; `secret` redacted (`null`) unless `?include_secrets=true` (admin only); `secret_present` flags existence |
| `access_paths` | ordered `steps` → reproducible chain / attack narrative |
| `activity_log` | chronological operator timeline |
| `findings` | report-shaped, render-ready |
| `artifacts` | introduced things / cleanup list |
| `evidence_manifest` | filename, sha256, parent ref (no bytes) |

Secrets are **redacted by default**; the decrypted variant requires admin and
explicit `include_secrets=true`.

## Operational notes

- Run behind a TLS reverse proxy for any non-loopback access.
- Back up the `pgdata` **and** `evidence` volumes together — evidence files
  live on disk, their metadata in Postgres.
- All images are standard registry images; `docker compose pull` ahead of time
  for offline/air-gapped engagements.

## Status

| Milestone | Scope | State |
|-----------|-------|-------|
| M0 | Infra, Docker, CyberHerd theme, health | ✅ |
| M1 | Auth + Start Pentest wizard | ✅ |
| M2 | Fast host entry & state | ✅ |
| M3 | Compromised users / artifacts | ✅ |
| M4 | Frictionless evidence | ✅ |
| M5 | Access paths & graph | ✅ |
| M6 | Notes & findings | ✅ |
| M7 | Real-time sync | ✅ |
| M8 | Export contract & docs | ✅ |

**Phase 1 complete.** Phase 2 (report rendering, tool-output importers) builds
on the export contract above without schema rework.

### Rework R1–R7 (CyberHerd-driven) — complete

Real logo · engagement **Dashboard** + all-hosts list · **workstream
switcher** (creds stay cross-team) · Access Paths as **step-by-step
walkthrough + host map** · **Ghostwriter-style findings** (full field set,
CVSS 3.1 calculator, findings library) · admin user management · **nmap XML
import** (digested → hosts/services) · **workstream-tailored views** (Web:
sites↔hosts + domains/subdomains; AD panel) · **client management** ·
**covert infrastructure tracking** · structured **oplog**. Quick-log removed.
Data is structured Ghostwriter-compatibly for push via Ghostwriter's own API
(no built-in report engine by design).

See the full plan in `.claude/plans/`.
# HerdNote
