<p align="center">
  <img src="https://img.shields.io/badge/Gemma_AI-Powered-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemma AI Powered"/>
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License"/>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
</p>

# PatchFlow — Autonomous API Reliability Agent

> Point it at any running API + its GitHub repo. It discovers every endpoint,
> injects 18 failure modes, finds every gap, writes production-ready fixes,
> runs a senior code review, and opens Pull Requests — fully autonomously.

**Autonomous multi-agent API reliability testing and auto-fix pipeline**

Every agent is powered by **Gemma** (via Google AI Studio) and orchestrated through a tool-calling agentic loop with real-time WebSocket streaming to the dashboard.

---

## ⚡ What It Does

PatchFlow is an autonomous multi-agent system that stress-tests your API for resilience failures and automatically fixes them. You provide two things — a running API URL and a GitHub repository — and the agent society handles everything else:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   You provide:  https://your-api.com  +  github.com/you/your-repo  │
│                                                                     │
│   Agent 1 — Discovery    Maps every endpoint (OpenAPI / Postman /   │
│                          manual input / auto-scan)                  │
│   Agent 2 — Chaos        Injects 18 failure modes per endpoint      │
│   Agent 3 — Analyst      Finds patterns, scores risk 0–100         │
│   Agent 4 — Fix          Writes production-ready error handlers     │
│   Agent 5 — Review       Senior code review of every fix            │
│   Agent 6 — GitHub       Opens PRs with reviewed, tested code       │
│                                                                     │
│   Result:  Reviewed Pull Requests ready to merge                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎬 Local Demo

### Try it locally with the included demo target app

The repo includes **Knowbite API** — a deliberately vulnerable FastAPI application with 7 intentional bugs (missing timeouts, leaked exceptions, unhandled errors). It serves as a realistic test target:

```bash
python run_demo.py                          # Without GitHub PRs
python run_demo.py your-username/your-repo  # With GitHub PRs
```

The demo runner will start the vulnerable app, fire the full agent pipeline against it, and stream results to your dashboard.

---

## 🏗️ Architecture

```
┌──────────────────────────────┐
│  Next.js Frontend (port 3000)│
│  Dashboard · Reports · Auth  │
└──────────┬───────────────────┘
           │ HTTP + WebSocket
┌──────────▼───────────────────┐      ┌────────────────────┐
│  FastAPI Backend (port 8000) │◄────►│  PostgreSQL (async) │
│                              │      └────────────────────┘
│  ┌────────────────────────┐  │
│  │   Agent Orchestrator   │  │      ┌────────────────────┐
│  │  ┌──────┐ ┌─────────┐ │  │      │   Gemma AI (Google) │
│  │  │Chaos │→│ Analyst │ │  │◄────►│   (gemma-3-27b-it)  │
│  │  └──────┘ └────┬────┘ │  │      └────────────────────┘
│  │          ┌─────▼─────┐ │  │
│  │          │    Fix    │ │  │      ┌────────────────────┐
│  │          └─────┬─────┘ │  │      │   GitHub API       │
│  │          ┌─────▼─────┐ │  │◄────►│   (PyGithub)       │
│  │          │  Review   │ │  │      └────────────────────┘
│  │          └─────┬─────┘ │  │
│  │          ┌─────▼─────┐ │  │
│  │          │  GitHub   │ │  │
│  │          └───────────┘ │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Agent Pipeline

| Stage | Agent | What It Does |
|-------|-------|-------------|
| 1 | **Discovery** | Auto-detects endpoints from OpenAPI specs, Postman collections, file uploads, or manual entry |
| 2 | **Chaos** | Injects 18 failure modes (timeouts, connection drops, malformed responses, DB failures, etc.) against each endpoint and observes the response |
| 3 | **Analyst** | Identifies failure patterns, classifies severity (CRITICAL / HIGH / MEDIUM / LOW), and calculates a risk score 0–100 |
| 4 | **Fix** | Clones the repo, locates the exact handler function, and generates a production-ready code fix with proper error handling |
| 5 | **Review** | Acts as a senior engineer — validates each fix against the full file context, requests revisions if needed (up to 2 rounds) |
| 6 | **GitHub** | Creates a branch, applies the fix, commits with a descriptive message, and opens a Pull Request with full context |

### 18 Failure Modes

| Category | Modes |
|----------|-------|
| **Network** | `http_timeout` · `connection_refused` · `dns_failure` · `slow_response` · `connection_reset` |
| **Dependency** | `http_500` · `http_429` · `http_503` · `http_401` · `http_404` |
| **Data** | `malformed_json` · `empty_response` · `wrong_content_type` · `partial_response` · `null_fields` |
| **Resource** | `db_connection_drop` · `db_timeout` · `db_constraint_violation` |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- A [Gemma API key](https://aistudio.google.com/apikey) from Google AI Studio
- A GitHub account (for OAuth login and PR creation)

### 1. Clone the repository

```bash
git clone https://github.com/jaytech504/chaos-agent.git
cd chaos-agent
```

### 2. Set up the backend

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..

# Create the database (it will auto-create tables on first run)
psql -U postgres -c "CREATE DATABASE chaos_agent;"
```

### 3. Set up the frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configure environment variables

```bash
cp backend/.env.example .env
```

Edit `.env` and fill in the required values:

```env
# ── Required ──────────────────────────────────────────────
GEMMA_API_KEY=your-gemma-api-key            # Google AI Studio API key
GITHUB_CLIENT_ID=your_oauth_client_id     # GitHub OAuth App → Client ID
GITHUB_CLIENT_SECRET=your_oauth_secret    # GitHub OAuth App → Client Secret
JWT_SECRET=a-strong-random-secret         # Generate with: openssl rand -hex 32

# ── Required for PR creation ─────────────────────────────
GITHUB_TOKEN=ghp_your_personal_token      # GitHub PAT with `repo` scope

# ── Pre-configured (change if needed) ────────────────────
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/chaos_agent
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_MODEL=gemma-3-27b-it
FRONTEND_URL=http://localhost:3000
APP_ENV=development
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
```

> **GitHub OAuth App Setup**: Go to [GitHub Developer Settings](https://github.com/settings/developers) → New OAuth App.
> Set the callback URL to `http://localhost:3000/auth/callback`.

### 5. Start the application

```bash
# Terminal 1 — Backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000** — you'll see the PatchFlow landing page. Click "Login with GitHub" to authenticate, then create a new session from the dashboard.

---

## 🖥️ Frontend

The PatchFlow frontend is a full-featured Next.js 16 application with a premium developer-tool aesthetic.

### Pages

| Page | Description |
|------|-------------|
| **Landing** (`/`) | Marketing page with feature cards, animated terminal demo, and how-it-works section |
| **Login** (`/login`) | GitHub OAuth single sign-on |
| **Dashboard** (`/dashboard`) | Analytics strip (tests run, failures found, fixes generated, avg risk score) + session list |
| **New Session** (`/sessions/new`) | Two-step form: configure target + select discovered endpoints |
| **Live Session** (`/sessions/[id]`) | Real-time WebSocket agent trace — watch the pipeline run live |
| **Reliability Report** (`/sessions/[id]/report`) | Risk score, expandable findings, GitHub-styled PR cards, side-by-side code diffs |

### Endpoint Discovery Options

When creating a new session, you can provide endpoints via:
1. **OpenAPI URL** — paste a link to your OpenAPI spec
2. **File Upload** — drag & drop an OpenAPI JSON/YAML file
3. **Postman Collection** — upload a Postman Collection v2.1 JSON
4. **Manual Entry** — add endpoints one by one (method + path)

---

## 📡 API Reference

```
POST   /api/sessions/start           Start a new chaos session
GET    /api/sessions                  List all sessions
GET    /api/sessions/{id}             Session detail + failures + PRs
POST   /api/sessions/{id}/rerun       Re-run a session

GET    /api/reports/session/{id}      Get report ID for a session
GET    /api/reports/{id}              Full report with fixes and findings

POST   /api/discovery/preview/url     Preview endpoints from OpenAPI URL
POST   /api/discovery/preview/spec-file  Preview from uploaded spec file
POST   /api/discovery/preview/postman Preview from Postman collection

GET    /api/auth/github/login         Start GitHub OAuth flow
GET    /api/auth/github/callback      OAuth callback handler
GET    /api/auth/repos                List user's GitHub repositories

GET    /api/github                    List all PRs
POST   /api/github/webhook            GitHub webhook receiver
POST   /api/github/{id}/sync          Manually sync PR status

WS     /ws/{session_id}               Live agent trace stream (WebSocket)

GET    /health                        Health check
```

---

## 🔧 GitHub Integration

PatchFlow uses each user's GitHub OAuth token to open PRs on their behalf. When a user authenticates via "Login with GitHub", the OAuth flow requests `repo`, `read:user`, and `user:email` scopes. This token is used for all GitHub operations.

A static `GITHUB_TOKEN` in `.env` serves as a fallback for development/demo use when OAuth is not configured.

### How PRs Are Created

1. **Clone** — the agent clones your repo to a temp directory
2. **Locate** — finds the exact function handler for the vulnerable endpoint
3. **Fix** — generates error handling code (try/catch, timeouts, retries)
4. **Review** — a Review Agent validates the fix against the full file context
5. **Branch** — creates `chaos-agent/fix-{name}-{session-id}`
6. **Commit** — descriptive message: `fix: Add timeout handling for payment API`
7. **Open PR** — full description with what was found and why the fix works

### Webhook (Optional)

For real-time PR merge notifications in the dashboard:

1. Go to your repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `https://your-server.com/api/github/webhook`
3. Content type: `application/json`
4. Events: select **Pull requests**

---

## 🧪 Demo Target: Knowbite API

The repo includes a deliberately vulnerable demo app (`demo_target/`) simulating an ed-tech platform with 7 intentional bugs:

| Route | Vulnerability |
|-------|--------------|
| `GET /users/{id}` | No exception handling — raises raw `KeyError` |
| `POST /users` | No duplicate check, no DB error handling |
| `GET /users/{id}/recommendations` | External API call with no timeout or retry |
| `POST /enroll` | Leaks raw exception messages (DB schema exposed) |
| `POST /payments/process` | External payment API with no timeout/retry/429 handling |
| `GET /courses/{id}/content` | External CDN call with `timeout=None` |
| `GET /courses/{id}/analytics` | No null/empty response handling, crashes on missing keys |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI** | Gemma (gemma-4-26b-a4b-it) via Google AI Studio — tool-calling agentic loop |
| **Backend** | FastAPI · Python 3.11 · async/await throughout |
| **Database** | PostgreSQL with asyncpg + SQLAlchemy 2.0 (async) |
| **Real-time** | WebSockets for live agent trace streaming |
| **GitHub** | PyGithub + GitPython for cloning, branching, and PR creation |
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Framer Motion |
| **Auth** | GitHub OAuth 2.0 → JWT sessions |

---

## 📂 Project Structure

```
chaos-agent/
├── backend/
│   ├── agents/              # 6 autonomous AI agents
│   │   ├── base.py          # BaseAgent — Gemma tool-calling loop
│   │   ├── discovery_agent.py
│   │   ├── chaos_agent.py
│   │   ├── analyst_agent.py
│   │   ├── fix_agent.py
│   │   ├── review_agent.py
│   │   ├── github_agent.py
│   │   └── orchestrator.py  # Pipeline coordinator
│   ├── api/                 # FastAPI route handlers
│   ├── auth/                # GitHub OAuth + JWT
│   ├── chaos/               # Failure mode definitions + injection proxy
│   ├── core/                # Config, WebSocket manager, caching
│   ├── db/                  # SQLAlchemy models + async session
│   ├── main.py              # FastAPI app entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # UI components (navbar, terminal, etc.)
│   │   └── lib/             # Utilities + API config
│   └── package.json
├── demo_target/             # Deliberately vulnerable demo API
├── run_demo.py              # One-command demo runner
└── .env.example             # Environment variable template
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
