<p align="center">
  <img src="https://img.shields.io/badge/Gemma_AI-Powered-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemma AI Powered"/>
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License"/>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
</p>

# PatchFlow — Autonomous API Reliability Agent

> Point it at any running API + its GitHub repo. It discovers endpoints,
> injects failure modes, finds every gap, writes production-ready fixes,
> and opens Pull Requests — fully autonomously.

Every agent is powered by **Gemma AI** (via Google AI Studio) with real-time WebSocket streaming.

🔗 **Live App**: [https://patchflow-frontend-n23j.onrender.com](https://patchflow-frontend-n23j.onrender.com)
📦 **Repo**: [https://github.com/jaytech504/patch-flow](https://github.com/jaytech504/patch-flow)

---

## How It Works

```
You provide:  https://your-api.com  +  github.com/you/your-repo

  Agent 1 — Discovery    Maps every endpoint
  Agent 2 — Chaos        Injects 18 failure modes per endpoint
  Agent 3 — Analyst      Scores risk 0–100, classifies severity
  Agent 4 — Fix          Writes production-ready error handlers
  Agent 5 — Review       Senior code review of every fix
  Agent 6 — GitHub       Opens PRs with reviewed code

Result:  Reviewed Pull Requests ready to merge
```

Works with **Python** (FastAPI, Flask, Django), **TypeScript/JavaScript** (Next.js, React, Express, Supabase), **Go**, **Ruby**, and **Java**.

### Agent Pipeline

| Stage | Agent | What It Does |
|-------|-------|-------------|
| 1 | **Discovery** | Auto-detects endpoints from OpenAPI specs, Postman collections, file uploads, or manual entry |
| 2 | **Chaos** | Injects 18 failure modes (timeouts, connection drops, malformed responses, DB failures, etc.) per endpoint |
| 3 | **Analyst** | Identifies failure patterns, classifies severity (CRITICAL / HIGH / MEDIUM / LOW), scores risk 0–100 |
| 4 | **Fix** | Clones the repo, locates the exact handler function, generates a production-ready code fix |
| 5 | **Review** | Acts as a senior engineer — validates each fix against full file context, requests revisions if needed |
| 6 | **GitHub** | Creates a branch, applies the fix, commits, and opens a Pull Request with full context |

---

## 🌐 Using PatchFlow (Live Site)

### Step 1 — Sign In

Go to [patchflow-frontend-n23j.onrender.com](https://patchflow-frontend-n23j.onrender.com) and click **"Login with GitHub"**. This grants PatchFlow permission to read your repos and open PRs on your behalf.

### Step 2 — Create a New Session

From the **Dashboard**, click **"New Session"** and fill in:

| Field | What to enter |
|-------|---------------|
| **Target API URL** | The live URL of the API you want to test (e.g. `https://your-app.com`) |
| **GitHub Repository** | Select the repo containing the source code for that API |

### Step 3 — Add Endpoints

Choose how to provide your API endpoints:

- **Manual Entry** — Type each endpoint (e.g. `GET /dashboard`, `POST /users`)
- **OpenAPI URL** — Paste a link to your OpenAPI/Swagger spec
- **File Upload** — Drag & drop an OpenAPI JSON/YAML file
- **Postman Collection** — Upload a Postman v2.1 JSON export

Click **"Start Scan"** to begin.

### Step 4 — Watch It Run

The **Live Session** page shows real-time agent activity via WebSocket:
- Chaos Agent injecting failures against each endpoint
- Analyst Agent scoring risk and classifying findings
- Fix Agent locating source code and generating fixes
- Review Agent validating each fix

### Step 5 — Review Results

Once complete, the **Reliability Report** shows:
- **Risk Score** (0–100) with severity breakdown
- **Findings** — each vulnerability with affected endpoints and failure modes
- **Fixes** — generated code patches with before/after diffs
- **Pull Requests** — links to PRs opened on your GitHub repo, ready to review and merge

---

## 💻 Running Locally

### Prerequisites

- Python 3.11+ · Node.js 20+ · PostgreSQL 14+
- [Gemma API key](https://aistudio.google.com/apikey) from Google AI Studio
- [GitHub OAuth App](https://github.com/settings/developers) (callback URL: `http://localhost:3000/auth/callback`)

### Setup

```bash
git clone https://github.com/jaytech504/patch-flow.git
cd patch-flow

# Backend
cd backend && pip install -r requirements.txt && cd ..
psql -U postgres -c "CREATE DATABASE chaos_agent;"

# Frontend
cd frontend && npm install && cd ..
```

Create a `.env` file in the root:

```env
GEMMA_API_KEY=your-gemma-api-key
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_MODEL=gemma-4-26b-a4b-it
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/chaos_agent
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_secret
GITHUB_TOKEN=ghp_your_personal_token
JWT_SECRET=a-strong-random-secret
FRONTEND_URL=http://localhost:3000
```

### Run

```bash
# Terminal 1
uvicorn backend.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open **http://localhost:3000**.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI** | Gemma (gemma-4-26b-a4b-it) via Google AI Studio |
| **Backend** | FastAPI · Python 3.11 · async/await |
| **Database** | PostgreSQL + asyncpg + SQLAlchemy 2.0 |
| **Real-time** | WebSockets |
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| **Auth** | GitHub OAuth 2.0 → JWT |

---

## 📄 License

[MIT License](LICENSE)
