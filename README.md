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

Repository: [https://github.com/jaytech504/patch-flow](https://github.com/jaytech504/patch-flow)

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

## 🌐 Live Application

Access the live deployment on Render:
👉 **[https://patchflow-frontend-n23j.onrender.com](https://patchflow-frontend-n23j.onrender.com)**

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
| 5 | **Review** | Acts as a senior engineer — validates each fix against the full file context, requests revisions if needed |
| 6 | **GitHub** | Creates a branch, applies the fix, commits with a descriptive message, and opens a Pull Request with full context |

### 18 Failure Modes

| Category | Modes |
|----------|-------|
| **Network** | `http_timeout` · `connection_refused` · `dns_failure` · `slow_response` · `connection_reset` |
| **Dependency** | `http_500` · `http_429` · `http_503` · `http_401` · `http_404` |
| **Data** | `malformed_json` · `empty_response` · `wrong_content_type` · `partial_response` · `null_fields` |
| **Resource** | `db_connection_drop` · `db_timeout` · `db_constraint_violation` |

### Multi-Stack & Framework Support

PatchFlow analyzes and generates fixes for repositories built with:
- **TypeScript / JavaScript**: Next.js (App Router & Pages Router), React SPAs, Supabase Edge Functions, Express, Fastify, NestJS
- **Python**: FastAPI, Flask, Django
- **Go**: Standard `net/http`, Gin, Fiber
- **Ruby**: Ruby on Rails
- **Java**: Spring Boot

---

## 💻 Local Setup Guide

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- A [Gemma API key](https://aistudio.google.com/apikey) from Google AI Studio
- A GitHub account (for OAuth login and PR creation)

### 1. Clone the repository

```bash
git clone https://github.com/jaytech504/patch-flow.git
cd patch-flow
```

### 2. Set up the backend

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..

# Create PostgreSQL database (tables will be auto-created on first run)
psql -U postgres -c "CREATE DATABASE chaos_agent;"
```

### 3. Set up the frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

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

> **GitHub OAuth Setup**: Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps.
> - **Homepage URL**: `http://localhost:3000`
> - **Authorization callback URL**: `http://localhost:3000/auth/callback`

### 5. Start the application

```bash
# Terminal 1 — Backend (FastAPI)
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (Next.js)
cd frontend
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ☁️ Render Cloud Deployment Guide

PatchFlow includes a pre-configured [`render.yaml`](render.yaml) blueprint for 1-click deployment on Render's Free tier.

### Render Setup Steps

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy to Render"
   git push origin main
   ```
2. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**.
3. Connect `https://github.com/jaytech504/patch-flow`.
4. Render will create:
   - **`patchflow-db`**: Managed PostgreSQL Database (Free Tier)
   - **`patchflow-backend`**: FastAPI Python Web Service (Free Tier)
   - **`patchflow-frontend`**: Next.js Node Web Service (Free Tier)
5. Set `GEMMA_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_TOKEN` under **`patchflow-backend`** → **Environment**.
6. Set `NEXT_PUBLIC_API_URL` under **`patchflow-frontend`** → **Environment**.

> **GitHub OAuth App for Cloud**:
> - **Homepage URL**: `https://patchflow-frontend-n51l.onrender.com`
> - **Authorization callback URL**: `https://patchflow-frontend-n51l.onrender.com/auth/callback`

---

## 🖥️ Frontend Overview

The PatchFlow frontend is a Next.js 16 application built with TypeScript, Tailwind CSS v4, and Lucide icons.

### Pages

| Page | Description |
|------|-------------|
| **Landing** (`/`) | Product overview, feature cards, and terminal demo |
| **Login** (`/login`) | GitHub OAuth single sign-on |
| **Dashboard** (`/dashboard`) | Analytics strip (tests run, failures found, fixes generated) + session history |
| **New Session** (`/sessions/new`) | Target setup + endpoint selector (OpenAPI, Postman, file upload, manual entry) |
| **Live Session** (`/sessions/[id]`) | Real-time WebSocket agent trace — live step logs and failure pills |
| **Reliability Report** (`/sessions/[id]/report`) | Risk score, expandable findings, GitHub PR cards, side-by-side code diffs |

---

## 📡 API Reference

```
POST   /api/sessions/start           Start a new chaos session
GET    /api/sessions                  List all sessions
GET    /api/sessions/{id}             Session detail + failures + PRs
POST   /api/sessions/{id}/retry       Re-run a session

GET    /api/reports/session/{id}      Get report ID for a session
GET    /api/reports/{id}              Full report with fixes and findings

POST   /api/discovery/preview/url     Preview endpoints from OpenAPI URL
POST   /api/discovery/preview/spec-file  Preview from uploaded spec file
POST   /api/discovery/preview/postman Preview from Postman collection
POST   /api/discovery/preview/manual  Preview manual endpoint entries

GET    /api/auth/github/login         Start GitHub OAuth flow
GET    /api/auth/github/callback      OAuth callback handler
GET    /api/auth/repos                List user's GitHub repositories

GET    /api/github                    List all PRs
POST   /api/github/webhook            GitHub webhook receiver

WS     /ws/{session_id}               Live agent trace stream (WebSocket)

GET    /health                        Health check
```

---

## 📂 Project Structure

```
patch-flow/
├── backend/
│   ├── agents/              # 6 autonomous AI agents (Gemma powered)
│   │   ├── base.py          # BaseAgent — Gemma tool-calling loop
│   │   ├── discovery_agent.py
│   │   ├── chaos_agent.py
│   │   ├── analyst_agent.py
│   │   ├── fix_agent.py     # Code locator & multi-stack fix generator
│   │   ├── review_agent.py  # Senior engineer code reviewer
│   │   ├── github_agent.py  # Git branching & PR generator
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
└── render.yaml              # Render Blueprint deployment config
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
