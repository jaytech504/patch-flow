<p align="center">
  <img src="https://img.shields.io/badge/Gemma_AI-Powered-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemma AI Powered"/>
  <img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License"/>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
</p>

# PatchFlow — Autonomous Dual-Engine API Reliability Platform

> **Stop finding bugs. Start fixing them.**  
> PatchFlow is a dual-engine reliability platform for modern backend APIs. It proactively stress-tests your endpoints with 18+ chaos failure modes before deployment and monitors production crashes in real-time — autonomously writing compiler-verified resilience patches and opening GitHub Pull Requests in seconds.

Powered by **Gemma AI** (via Google AI Studio) with real-time WebSocket streaming, AST syntax verification, and strict security guardrails.

🔗 **Live App**: [https://patchflow-frontend-n23j.onrender.com](https://patchflow-frontend-n23j.onrender.com)  
📦 **Repository**: [https://github.com/jaytech504/patch-flow](https://github.com/jaytech504/patch-flow)

---

## ⚡ The Dual-Engine Architecture

PatchFlow protects your software lifecycle at both stages: **pre-deployment testing** and **post-deployment monitoring**.

```
                           ┌─────────────────────────────────────────────────────────┐
                           │                     PATCHFLOW CORE                      │
                           └─────────────────────────────────────────────────────────┘
                                   │                                     │
           ENGINE 1: PROACTIVE     │                                     │     ENGINE 2: REACTIVE
           CHAOS STRESS TESTING    │                                     │     PRODUCTION MONITORING
                                   ▼                                     ▼
                      ┌─────────────────────────┐           ┌─────────────────────────┐
                      │    Target API URL       │           │  Live Production Apps   │
                      │  + OpenAPI / Postman    │           │ (FastAPI, Next.js, etc.)│
                      └────────────┬────────────┘           └────────────┬────────────┘
                                   │                                     │
                                   ▼                                     ▼
                      ┌─────────────────────────┐           ┌─────────────────────────┐
                      │ Discovery & ChaosProxy  │           │   PatchFlow Agent SDK   │
                      │  18 Failure Modes       │           │  One-line Integration   │
                      └────────────┬────────────┘           └────────────┬────────────┘
                                   │                                     │
                                   ▼                                     ▼
                      ┌─────────────────────────┐           ┌─────────────────────────┐
                      │  Analyst Agent (Gemma)  │           │ Ingestion & PII Redact  │
                      │  0–100 Risk Score       │           │ Dedup & Occurrence Cap  │
                      └────────────┬────────────┘           └────────────┬────────────┘
                                   │                                     │
                                   └──────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │   FixAgent (Gemma AI)       │
                                       │   AST Route & Patch Locator │
                                       └──────────────┬──────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │   ReviewAgent               │
                                       │   Syntax & Compiler Checks  │
                                       └──────────────┬──────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │   GitHubAgent               │
                                       │   Automated Pull Request    │
                                       └─────────────────────────────┘
```

---

## 🌪️ Engine 1: Autonomous Chaos Testing

Engine 1 proactively surfaces fragility in your backend before your users do. It maps endpoints, simulates cascading failures and network partitions, audits data leakage, and patches missing error boundaries.

### 1. Endpoint Discovery Modes
- **OpenAPI / Swagger URL**: Connect to a live `openapi.json` or Swagger endpoint.
- **File Upload**: Drag-and-drop OpenAPI 3.0+ / Swagger JSON or YAML files.
- **Postman Collections**: Upload Postman v2.1 JSON collection exports.
- **Repository Analysis**: Auto-detect routes from cloned project source files.
- **Manual Entry**: Specify individual route paths, parameters, and HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).

### 2. The 18 Chaos Failure Modes
Each endpoint is exercised against 18 deterministic failure modes across 4 categories:

| Category | Failure Mode ID | Description |
|:---|:---|:---|
| **Network** | `http_timeout` | Outbound HTTP requests hang indefinitely without returning |
| | `connection_refused` | Upstream service is down; TCP connection refused |
| | `dns_failure` | Upstream dependency hostname cannot be resolved |
| | `slow_response` | Upstream responds with a 5000ms delay to test timeout handling |
| | `connection_reset` | TCP connection is forcibly reset mid-transfer |
| **Dependency** | `http_500` | Upstream microservice returns Internal Server Error |
| | `http_429` | Upstream dependency returns Too Many Requests (Rate Limited) |
| | `http_503` | Upstream dependency is temporarily Unavailable |
| | `http_401` | Upstream service rejects credentials / unauthorized |
| | `http_404` | Upstream dependency route or resource not found |
| **Data** | `malformed_json` | Dependency responds with invalid, unparseable JSON payloads |
| | `empty_response` | Dependency returns `200 OK` with an empty response body |
| | `wrong_content_type` | Upstream returns HTML (e.g. cloud error page) instead of JSON |
| | `partial_response` | Response stream is truncated abruptly mid-transfer |
| | `null_fields` | Dependency returns JSON with required fields set to `null` |
| **Resource** | `db_connection_drop` | Database connection lost or socket drops mid-query |
| | `db_timeout` | Database query exceeds timeout threshold |
| | `db_constraint_violation` | Database rejects insert/update due to integrity constraint |

### 3. Vulnerability Analysis & Risk Scoring
- **Reliability Score (0–100)** calculated using severity weights.
- **Severity Classification**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
- **Sensitive Data Leakage Audit**: Detects leaked stack traces, SQL error strings, database connection strings, or system paths exposed in responses.

---

## 📡 Engine 2: Real-Time Production Monitoring & SDKs

Engine 2 provides zero-overhead, production-grade exception capture. Install the SDK in your backend with a single line of code. When an unhandled error reaches a configurable threshold, PatchFlow automatically initiates the repair pipeline and opens a draft GitHub PR.

### Supported Monitoring Frameworks

#### 🐍 Python SDK (`patchflow-sdk/python/`)

Install via pip or include `patchflow.py`:

```bash
pip install patchflow-agent
# or copy patchflow.py into your project root
```

* **FastAPI / Starlette** (one line — auto-registers ASGI middleware):
  ```python
  import os
  from fastapi import FastAPI
  import patchflow

  app = FastAPI()
  patchflow.init(api_key=os.environ["PATCHFLOW_API_KEY"])
  ```

* **Flask**:
  ```python
  import os
  from flask import Flask
  import patchflow

  app = Flask(__name__)
  patchflow.init(api_key=os.environ["PATCHFLOW_API_KEY"], app=app)
  ```

* **Django / DRF**:
  Add `PatchFlowDjangoMiddleware` to `MIDDLEWARE` in `settings.py`:
  ```python
  MIDDLEWARE = [
      "patchflow.PatchFlowDjangoMiddleware",
      "django.middleware.security.SecurityMiddleware",
      # ...
  ]

  import patchflow
  patchflow.init(api_key=os.environ["PATCHFLOW_API_KEY"])
  ```

* **Manual Exception Capture & Decorators**:
  ```python
  import patchflow
  patchflow.init(api_key="pf_live_...")

  @app.get("/orders")
  @patchflow.monitor
  async def get_orders():
      ...

  try:
      execute_task()
  except Exception as exc:
      patchflow.capture_exception(exc)
      raise
  ```

---

#### 🟢 Node.js / TypeScript SDK (`patchflow-sdk/node/`)

Install via npm or include `patchflow.js` (zero dependencies, uses native Node HTTPS):

```bash
npm install patchflow-agent
# or copy patchflow.js into your project
```

* **Next.js (App Router, Pages Router & Server Components)**:
  Add a single `instrumentation.ts` file in your root or `src/`:
  ```typescript
  // instrumentation.ts
  import patchflow from "./patchflow";

  export function register() {
    patchflow.init({
      apiKey: process.env.PATCHFLOW_API_KEY!,
      host: process.env.PATCHFLOW_HOST,
    });
  }
  ```
  *Runs once when the server boots. Automatically captures crashes across routes, server actions, and Edge runtimes without modifying individual files.*

* **Next.js Route Handlers** (per-route wrapper option):
  ```typescript
  import patchflow from "@/lib/patchflow";
  import { NextRequest, NextResponse } from "next/server";

  export const GET = patchflow.wrapNextHandler(async (req: NextRequest) => {
    const data = await db.query();
    return NextResponse.json(data);
  });
  ```

* **Express.js**:
  ```javascript
  const express = require("express");
  const patchflow = require("./patchflow");

  const app = express();
  patchflow.init({ apiKey: process.env.PATCHFLOW_API_KEY });

  // ... your routes ...

  // Place error middleware after all routes
  app.use(patchflow.expressMiddleware());
  ```

* **Hono**:
  ```typescript
  import { Hono } from "hono";
  import patchflow from "./patchflow";

  const app = new Hono();
  patchflow.init({ apiKey: process.env.PATCHFLOW_API_KEY });
  app.use("*", patchflow.honoMiddleware());
  ```

---

#### ☕ Java / Spring Boot (`frontend/public/sdk/PatchFlowAdvice.java`)

* **Spring Boot 3+ / Java 17+**:
  Drop `PatchFlowAdvice.java` directly into your main package alongside your `@SpringBootApplication` class.
  - Zero external Maven/Gradle dependencies (uses built-in `java.net.http.HttpClient`).
  - Auto-detected by Spring Boot's `@RestControllerAdvice` component scan.
  - Set `PATCHFLOW_API_KEY` as an environment variable and crashes are routed automatically.

---

### How the Ingestion & Monitoring Pipeline Works

1. **Ingestion Endpoint** (`POST /api/sdk/errors`):
   - Authenticated with `pf_live_...` API keys via `X-PatchFlow-Key` or `Authorization: Bearer` headers.
   - Keys are hashed with SHA-256 before database lookup.
2. **SDK Health Heartbeat** (`POST /api/sdk/ping`):
   - Automatic ping updates the monitored site's status (`active`, `not_installed`, `error`) and records `sdk_last_seen`.
3. **Server-Side PII & Secret Redaction**:
   - Every incoming event passes through `backend/core/redactor.py`.
   - Redacts Bearer tokens, JWTs, database DSNs (`postgresql://***REDACTED***`), email addresses (`***EMAIL***`), passwords, API keys, and authorization headers before storage or LLM processing.
4. **Deterministic Fingerprinting & Deduplication**:
   - Errors generate a stable SHA-256 fingerprint:
     $$\text{fingerprint} = \text{SHA256}(\text{site\_id} + \text{error\_type} + \text{stack\_file} + \text{lineno})$$
   - Prevents duplicate incidents from spawning multiple branches for the same bug.
5. **Threshold-Based Pipeline Execution**:
   - The autonomous repair pipeline triggers once an error exceeds the threshold (`INCIDENT_MIN_EVENTS=3` by default) to filter transient blips.
6. **Safety Guardrails & Blocklist**:
   - Files matching patterns such as `auth`, `login`, `oauth`, `jwt`, `billing`, `payment`, `stripe`, `checkout`, `alembic`, `migration`, `secret`, `admin` are **strictly blocked** from automated patching to safeguard critical security paths.

---

## 🤖 The Autonomous Agent Pipeline

PatchFlow uses a cooperative multi-agent architecture powered by **Gemma AI**:

| Agent | Responsibility |
|:---|:---|
| **Agent 1 — Discovery** | Extracts routes and parameters from OpenAPI specs, Postman collections, source files, or manual inputs |
| **Agent 2 — Chaos** | Executes real HTTP calls via `ChaosProxy`, injecting 18 failure modes and measuring app resilience |
| **Agent 3 — Analyst** | Identifies failure patterns, classifies severity, audits error leaks, and computes the 0–100 risk score |
| **Agent 4 — Fix** | Clones the target repo, isolates the offending handler via AST traversal, generates framework-idiomatic error handlers, and auto-injects missing imports |
| **Agent 5 — Review** | Acts as a senior staff engineer. Runs AST validation, bracket checking, and language compile checks. Filters out non-syntactic diagnostics |
| **Agent 6 — GitHub** | Creates a dedicated branch, commits verified patches, and opens a clean GitHub Pull Request with failure descriptions and diffs |

### Compiler & Syntax Verification
Before any PR is created, the patch passes through two verification engines:
- **`SyntaxValidator`**: Inspects generated code with AST parsing for Python, bracket verification, and isolated TypeScript diagnostics (distinguishing TS1000–TS1999 syntactic errors from TS2000+ semantic/module-resolution warnings on ephemeral clones).
- **`PatchValidator`**: Confirms relative repository paths, scrubs residual LLM formatting tokens (such as `<thought>` or markdown artifacts), and guards against accidental secret leakage.

---

## 🧪 Incident Simulation & CLI Tools

PatchFlow includes CLI simulation tools in `scripts/` to stress-test your monitoring setup and verify the end-to-end autonomous fix pipeline:

```bash
# Simulate a FastAPI incident
python scripts/simulate_incident.py --api-key pf_live_your_key --framework fastapi

# Simulate a Next.js incident
node scripts/simulate_incident.js --apiKey pf_live_your_key --framework nextjs

# Simulate custom error parameters
python scripts/simulate_incident.py \
  --api-key pf_live_your_key \
  --endpoint /api/v1/orders \
  --file app/routers/orders.py \
  --line 42 \
  --error-type DatabaseConnectionError \
  --message "Connection lost to replica pool" \
  --count 3
```

Available preset scenarios: `fastapi`, `nextjs`, `express`, `django`, `hono`.

---

## 💻 Local Development & Setup

### Prerequisites
- **Python 3.11+**
- **Node.js 20+**
- **PostgreSQL 14+**
- [Google AI Studio API Key](https://aistudio.google.com/apikey) (for Gemma AI)
- [GitHub OAuth Application](https://github.com/settings/developers) (Callback URL: `http://localhost:3000/auth/callback`)

### 1. Clone the Repository
```bash
git clone https://github.com/jaytech504/patch-flow.git
cd patch-flow
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Gemma AI (Google AI Studio)
GEMMA_API_KEY=your_gemma_api_key_here
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_THINKING_LEVEL=minimal

# Database & Environment
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/chaos_agent
APP_ENV=development
FRONTEND_URL=http://localhost:3000

# GitHub Integration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_TOKEN=ghp_your_personal_access_token_fallback

# Security
JWT_SECRET=super-secret-jwt-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=72

# Incident Pipeline Thresholds
INCIDENT_MIN_EVENTS=3
INCIDENT_MIN_USERS=1
INCIDENT_ENVIRONMENTS=production,staging,development
```

### 3. Backend Setup
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE chaos_agent;"

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# Start backend server (Terminal 1)
uvicorn backend.main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
# Install frontend dependencies
cd frontend
npm install

# Start Next.js development server (Terminal 2)
npm run dev
```

Open **http://localhost:3000** in your browser.

### 5. Running the Test Suite
```bash
# Run unit and regression tests
python -m unittest discover backend/tests
```

Test coverage includes:
- `test_sdk_monitoring.py` — Ingestion, API key validation, PII redactor, fingerprinting, threshold trigger
- `test_patch_validation.py` — Patch safety, instruction marker removal, secret filters
- `test_syntax_validator.py` — Multi-language AST and TypeScript error isolation
- `test_security_guards.py` — Critical path blocklist enforcement
- `test_orchestrator_review_regressions.py` — ReviewAgent iteration and recovery

---

## 📂 Project Structure

```
patch-flow/
├── backend/
│   ├── agents/                  # Multi-agent orchestrator & Gemma agents
│   │   ├── discovery_agent.py   # Endpoint & route detection
│   │   ├── chaos_agent.py       # Chaos test execution engine
│   │   ├── analyst_agent.py     # Risk scoring & severity classification
│   │   ├── fix_agent.py         # Code patch generation (FastAPI, Next.js, Django, etc.)
│   │   ├── review_agent.py      # Senior code review & AST validation
│   │   ├── github_agent.py      # Branch creation & Pull Request management
│   │   └── orchestrator.py      # Session workflow coordinator
│   ├── api/                     # FastAPI REST & WebSocket routers
│   │   ├── auth.py              # GitHub OAuth & JWT sessions
│   │   ├── billing.py           # Subscription & Lemon Squeezy integration
│   │   ├── discovery.py         # Spec parsing endpoints
│   │   ├── incidents.py         # Production incident feed endpoints
│   │   ├── sdk.py               # SDK error ingestion & heartbeat ping
│   │   ├── sessions.py          # Chaos test run management
│   │   └── sites.py             # Monitored sites & API key management
│   ├── chaos/                   # Chaos engineering core
│   │   ├── failure_modes.py     # 18 failure mode definitions & catalog
│   │   └── proxy.py             # ChaosProxy synthetic failure injector
│   ├── core/                    # Security, redaction & pipeline logic
│   │   ├── patch_validation.py  # Patch structure & secret validator
│   │   ├── redactor.py          # PII, credential & DSN sanitization
│   │   ├── sdk_incident_pipeline.py # Production error-to-PR coordinator
│   │   └── syntax_validator.py  # AST & compiler checks
│   ├── db/                      # SQLAlchemy async models & migrations
│   └── tests/                   # Backend unit and integration test suite
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js 16 App Router
│   │   │   ├── (app)/dashboard  # Metrics & test overview
│   │   │   ├── (app)/incidents  # Live production error feed
│   │   │   ├── (app)/sessions   # Real-time chaos test console
│   │   │   ├── (app)/sites      # Monitored apps & API key setup
│   │   │   └── page.tsx         # Landing page & live diff preview
│   │   ├── components/          # Reusable UI components (Tailwind v4)
│   │   └── lib/                 # Auth & API client utilities
│   └── public/sdk/              # Static downloadable SDKs (Java, JS, Python)
├── patchflow-sdk/
│   ├── node/                    # Node.js & TypeScript SDK package
│   │   ├── patchflow.js         # Universal Node / Next.js / Express SDK
│   │   └── patchflow.d.ts       # TypeScript definitions
│   └── python/                  # Python SDK package
│       └── patchflow.py         # FastAPI / Flask / Django SDK
├── scripts/
│   ├── simulate_incident.js     # Node.js incident simulator CLI
│   └── simulate_incident.py     # Python incident simulator CLI
└── render.yaml                  # Cloud deployment configuration
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|:---|:---|
| **AI Model** | Google Gemma (`gemma-4-26b-a4b-it`) via Google AI Studio |
| **Backend API** | FastAPI 0.111 · Python 3.11+ · Uvicorn · asyncio |
| **Database & ORM** | PostgreSQL 14+ · asyncpg · SQLAlchemy 2.0 |
| **Real-time Protocol** | WebSockets (live agent action streaming) |
| **Frontend Framework** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion |
| **Authentication** | GitHub OAuth 2.0 · JWT (JSON Web Tokens) |
| **SDKs** | Python (`httpx` / `urllib`), Node.js (native `https`), Java (JDK 11+ `HttpClient`) |
| **Deployment** | Render (Web Services + Managed PostgreSQL) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
