"use client";

import { useEffect, useRef, useState } from "react";
import {
  Globe, Plus, Trash2, Pencil, Loader2,
  Check, X, ExternalLink, Search, ChevronDown,
  Key, Copy, Terminal, Activity,
  AlertCircle, Download, Code, CheckCircle2,
  Server, Zap, FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";
import { authFetch } from "@/lib/auth-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface Site {
  id: string;
  name: string;
  url: string | null;
  github_repo: string | null;
  framework: string | null;
  active: boolean;
  sdk_status: "not_installed" | "active" | "error";
  sdk_last_seen: string | null;
  api_keys: ApiKey[];
  created_at: string;
  // Returned once on creation — never stored after that
  api_key?: string;
}

interface Repo { name: string; full_name: string; }

// ── Supported Frameworks Metadata ─────────────────────────────────────────────

export interface FrameworkConfig {
  id: string;
  name: string;
  language: string;
  tag: string;
  badgeColor: string;
  description: string;
  downloadFile: string;
  downloadFilename: string;
  placementHint: string;
  targetFile: string;
  whereToAdd: string;
  importantNote?: string;
  codeSnippet: (apiKey: string, hostParam: string) => string;
}

export const SUPPORTED_FRAMEWORKS: FrameworkConfig[] = [
  {
    id: "fastapi",
    name: "FastAPI",
    language: "Python",
    tag: "Async / ASGI",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    description: "ASGI middleware capturing unhandled exceptions across all async routes.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementHint: "Place in your project root alongside main.py (or in your app directory)",
    targetFile: "main.py",
    whereToAdd: "Add once in your FastAPI main entry file. Automatically monitors every endpoint across your app.",
    importantNote: "You do not need to wrap individual routes. The ASGI middleware intercepts crashes and unhandled exceptions globally.",
    codeSnippet: (apiKey: string, hostParam: string) => `import os
from fastapi import FastAPI
import patchflow
from patchflow import PatchFlowASGIMiddleware

app = FastAPI()

# 1. Initialise PatchFlow
pf = patchflow.init(
    api_key=os.getenv("PATCHFLOW_API_KEY", "${apiKey}")${hostParam}
)

# 2. Register ASGI error middleware
app.add_middleware(PatchFlowASGIMiddleware, patchflow=pf)

# ... your normal routes remain unchanged ...`,
  },
  {
    id: "express",
    name: "Express.js",
    language: "Node.js",
    tag: "JavaScript / TypeScript",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Connect error middleware capturing sync and async route handler crashes.",
    downloadFile: "/sdk/patchflow.js",
    downloadFilename: "patchflow.js",
    placementHint: "Place in project root or src/ directory",
    targetFile: "server.js (or app.js)",
    whereToAdd: "Add ONCE in your main server file. Do NOT put this on every route.",
    importantNote: "Do NOT wrap or modify your individual route handlers. Placing app.use(patchflow.expressMiddleware()) once at the bottom catches unhandled errors and rejected promises across your entire API automatically.",
    codeSnippet: (apiKey: string, hostParam: string) => `// Step 1: Add at the TOP of your server file
const patchflow = require('./patchflow');

patchflow.init({
  apiKey: process.env.PATCHFLOW_API_KEY || '${apiKey}'${hostParam}
});

// ... (keep ALL your existing routes untouched) ...
// app.get('/api/users', (req, res) => { ... });
// app.post('/api/orders', (req, res) => { ... });

// Step 2: Add ONCE at the very BOTTOM, after all routes (before app.listen):
app.use(patchflow.expressMiddleware());

app.listen(4000);`,
  },
  {
    id: "django",
    name: "Django / DRF",
    language: "Python",
    tag: "Django 4+ / 5+",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Django middleware capturing unhandled view exceptions & DRF crashes.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementHint: "Place in project root alongside manage.py (or in your app directory)",
    targetFile: "config/settings.py",
    whereToAdd: "Add once to your Django settings file. Covers all views, URLs, and DRF endpoints across your project.",
    importantNote: "Place 'patchflow.PatchFlowDjangoMiddleware' at or near the top of your MIDDLEWARE array.",
    codeSnippet: (apiKey: string, hostParam: string) => `import os
import patchflow

# 1. Initialise PatchFlow
patchflow.init(
    api_key=os.getenv("PATCHFLOW_API_KEY", "${apiKey}")${hostParam}
)

# 2. Add to MIDDLEWARE in settings.py:
MIDDLEWARE = [
    'patchflow.PatchFlowDjangoMiddleware', # Catches unhandled view exceptions globally
    'django.middleware.security.SecurityMiddleware',
    # ... your existing standard Django middlewares ...
]`,
  },
  {
    id: "springboot",
    name: "Spring Boot",
    language: "Java",
    tag: "Java 17+ / Spring 3+",
    badgeColor: "bg-green-50 text-green-700 border-green-200",
    description: "@RestControllerAdvice interceptor capturing unhandled runtime exceptions.",
    downloadFile: "/sdk/PatchFlowAdvice.java",
    downloadFilename: "PatchFlowAdvice.java",
    placementHint: "Place in src/main/java/com/yourpackage/ (Zero external dependencies required)",
    targetFile: "src/main/java/.../PatchFlowAdvice.java",
    whereToAdd: "Drop the file into your package. Spring Boot auto-detects @RestControllerAdvice to intercept errors globally.",
    importantNote: "Zero extra Maven or Gradle dependencies required. Uses the standard Java 11+ HttpClient.",
    codeSnippet: (apiKey: string, hostParam: string) => `// 1. Drop the downloaded PatchFlowAdvice.java into your source tree:
//    src/main/java/com/example/demo/PatchFlowAdvice.java

// 2. Set your API key in application.properties (or system env):
PATCHFLOW_API_KEY=${apiKey}

// That's it! Any unhandled exception thrown in any @RestController
// is automatically captured and reported to PatchFlow.`,
  },
  {
    id: "flask",
    name: "Flask",
    language: "Python",
    tag: "WSGI / Sync",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Flask errorhandler hook capturing 500 crashes across all blueprints.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementHint: "Place in project root next to app.py",
    targetFile: "app.py",
    whereToAdd: "Pass your Flask app instance once during initialization.",
    importantNote: "Covers all routes and blueprints across your Flask application automatically.",
    codeSnippet: (apiKey: string, hostParam: string) => `import os
from flask import Flask
import patchflow

app = Flask(__name__)

# Initialise PatchFlow with your Flask app object:
patchflow.init(
    api_key=os.getenv("PATCHFLOW_API_KEY", "${apiKey}"),
    app=app${hostParam}
)

# ... all your normal routes and blueprints remain unchanged ...`,
  },
];

// ── Repo dropdown ─────────────────────────────────────────────────────────────

function RepoDropdown({ value, repos, reposLoading, onChange }: {
  value: string; repos: Repo[]; reposLoading: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <div onClick={() => !reposLoading && setOpen(p => !p)}
        className={cn("flex items-center justify-between px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] cursor-pointer select-none transition-colors",
          reposLoading ? "bg-[#F8FAFC] cursor-not-allowed" : "bg-white hover:border-[#D4D1CC]")}>
        {reposLoading
          ? <span className="flex items-center gap-2 text-[#A3A099]"><Loader2 className="h-[13px] w-[13px] animate-spin" />Loading repos…</span>
          : <span className={value ? "font-mono text-[#111110]" : "text-[#A3A099]"}>{value || "Select connected repository"}</span>}
        <div className="flex items-center gap-1.5">
          {value && <span onClick={e => { e.stopPropagation(); onChange(""); }} className="text-[11px] text-[#A3A099] hover:text-[#6F6B66] px-1 rounded">Clear</span>}
          <ChevronDown className="h-[13px] w-[13px] text-[#A3A099]" />
        </div>
      </div>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-[#E7E5E2] rounded-[10px] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#F3F2F0] flex items-center gap-2">
            <Search className="h-[13px] w-[13px] text-[#A3A099] shrink-0" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search repos…"
              className="w-full text-[12px] bg-transparent border-none focus:outline-none text-[#111110]" />
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-[#F3F2F0]">
            {filtered.length === 0
              ? <p className="p-3 text-[12px] text-[#A3A099] text-center">No repos found.</p>
              : filtered.map(r => (
                <div key={r.full_name}
                  onClick={() => { onChange(r.full_name); setOpen(false); setSearch(""); }}
                  className={cn("px-3 py-2.5 text-[12px] font-mono cursor-pointer flex items-center justify-between hover:bg-[#F8FAFC]",
                    value === r.full_name && "bg-[#FFF1EC] text-[#FF5A1F] font-[600]")}>
                  <span>{r.full_name}</span>
                  {value === r.full_name && <Check className="h-[12px] w-[12px]" />}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SDK Setup Panel ───────────────────────────────────────────────────────────

function SdkSetupPanel({ site, apiKey, onClose }: { site: Site; apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  // Match initial framework tab with site's configured framework
  const initialFramework = SUPPORTED_FRAMEWORKS.find(
    f => f.id === site.framework?.toLowerCase() || f.name.toLowerCase().includes(site.framework?.toLowerCase() || "")
  )?.id || "fastapi";

  const [selectedFw, setSelectedFw] = useState<string>(initialFramework);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const liveHost = "https://patchflow-backend-xax6.onrender.com";
  const needsHost = API_BASE_URL !== liveHost;
  const hostParam = needsHost ? ", host: '" + API_BASE_URL + "'" : "";

  const activeFw = SUPPORTED_FRAMEWORKS.find(f => f.id === selectedFw) || SUPPORTED_FRAMEWORKS[0];
  const envSnippet = "PATCHFLOW_API_KEY=" + apiKey + (needsHost ? "\nPATCHFLOW_HOST=" + API_BASE_URL : "");
  const codeSnippet = activeFw.codeSnippet(apiKey, hostParam);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-2xl w-full max-w-[740px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E7E5E2] shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-[800] text-[#111110] tracking-tight">Connect {site.name}</h2>
              <span className="text-[11px] font-[600] bg-[#FFF1EC] text-[#FF5A1F] px-2 py-0.5 rounded-full">
                SDK Setup
              </span>
            </div>
            <p className="text-[13px] text-[#6F6B66] mt-0.5">
              Select your backend framework below for custom, copy-pasteable integration steps.
            </p>
          </div>
          <button onClick={onClose} className="text-[#A3A099] hover:text-[#111110] p-1.5 rounded-[6px] hover:bg-[#F3F2F0] transition-colors">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Framework Selector Tabs */}
        <div className="bg-[#F8FAFC] border-b border-[#E7E5E2] px-6 py-2.5 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {SUPPORTED_FRAMEWORKS.map(fw => {
              const isSelected = fw.id === selectedFw;
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFw(fw.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-all cursor-pointer",
                    isSelected
                      ? "bg-white text-[#111110] shadow-xs border border-[#E2E8F0]"
                      : "text-[#6F6B66] hover:text-[#111110] hover:bg-[#F1F5F9]"
                  )}
                >
                  <span>{fw.name}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-[500] border", fw.badgeColor)}>
                    {fw.language}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">

          {/* Framework Banner Info */}
          <div className="bg-[#FAFAF9] border border-[#E7E5E2] rounded-[10px] p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-[8px] bg-white border border-[#E7E5E2] flex items-center justify-center shrink-0">
                <Server className="h-4 w-4 text-[#FF5A1F]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-[700] text-[#111110]">{activeFw.name} Integration</span>
                  <span className="text-[10px] font-[600] text-[#6F6B66] bg-[#E7E5E2] px-1.5 py-0.5 rounded">{activeFw.tag}</span>
                </div>
                <p className="text-[12px] text-[#6F6B66] mt-0.5">{activeFw.description}</p>
              </div>
            </div>
          </div>

          {/* ── STEP 1: Add Environment Variable ────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">1</span>
              <span className="text-[14px] font-[700] text-[#111110]">Set Environment Variable</span>
            </div>
            <p className="text-[12px] text-[#6F6B66] ml-7">
              Add your site API key to your <code className="font-mono bg-[#F3F2F0] px-1.5 py-0.5 rounded text-[#111110]">.env</code> file or hosting platform (Render, Railway, Fly.io, etc.):
            </p>
            <div className="ml-7 relative">
              <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[12px_14px] rounded-[8px] overflow-x-auto">
                {envSnippet}
              </pre>
              <button onClick={() => copy("env", envSnippet)}
                className={cn("absolute top-2 right-2 flex items-center gap-1 text-[11px] font-[600] px-2 py-1 rounded-[5px] transition-colors cursor-pointer",
                  copied === "env" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                {copied === "env" ? <><Check className="h-[11px] w-[11px]" />Copied</> : <><Copy className="h-[11px] w-[11px]" />Copy</>}
              </button>
            </div>
          </div>

          {/* ── STEP 2: Download / Add SDK ──────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">2</span>
              <span className="text-[14px] font-[700] text-[#111110]">Add SDK to your Project</span>
            </div>
            <div className="ml-7 flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={activeFw.downloadFile}
                  download={activeFw.downloadFilename}
                  className="flex items-center gap-2 text-[12px] font-[700] text-white bg-[#111110] hover:bg-[#333] px-3.5 py-2 rounded-[8px] transition-colors"
                >
                  <Download className="h-[13px] w-[13px]" /> Download {activeFw.downloadFilename}
                </a>
                <span className="text-[12px] text-[#6F6B66]">{activeFw.placementHint}</span>
              </div>
            </div>
          </div>

          {/* ── STEP 3: Setup Code ──────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">3</span>
              <span className="text-[14px] font-[700] text-[#111110]">Initialize in your Code</span>
            </div>
            <div className="ml-7 flex flex-col gap-2.5">
              {/* Target File Header (Outside Code) */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 rounded-[8px]">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-[#FF5A1F]" />
                  <span className="text-[12px] text-[#6F6B66]">Target File:</span>
                  <code className="text-[12px] font-mono font-[700] text-[#111110] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded">
                    {activeFw.targetFile}
                  </code>
                </div>
                <span className="text-[11px] font-[600] text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full">
                  Add Once Globally
                </span>
              </div>

              {/* Explanatory instruction */}
              <p className="text-[12px] text-[#475569] leading-relaxed">
                {activeFw.whereToAdd}
              </p>

              {/* Pure Code Box */}
              <div className="relative">
                <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[14px_16px] rounded-[8px] overflow-x-auto leading-relaxed">
                  {codeSnippet}
                </pre>
                <button onClick={() => copy("code", codeSnippet)}
                  className={cn("absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-[600] px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer",
                    copied === "code" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                  {copied === "code" ? <><Check className="h-[11px] w-[11px]" />Copied</> : <><Copy className="h-[11px] w-[11px]" />Copy Code</>}
                </button>
              </div>

              {/* Global Coverage Clarification Callout */}
              {activeFw.importantNote && (
                <div className="bg-[#FFF8F5] border border-[#FFE2D5] rounded-[8px] p-3 text-[12px] text-[#9A3412] leading-relaxed flex items-start gap-2">
                  <Zap className="h-4 w-4 text-[#FF5A1F] shrink-0 mt-0.5" />
                  <div>
                    <strong>Global Coverage:</strong> {activeFw.importantNote}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Automatic Verification ─────────────────────────────────── */}
          <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[12px] p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-[700] text-[#166534]">Automatic Verification</span>
              <p className="text-[12px] text-[#166534]/90 leading-relaxed">
                When your backend application starts up with PatchFlow initialized, it automatically sends a lightweight background heartbeat. This site&apos;s status on your dashboard will immediately update to <span className="font-[700] text-[#16A34A]">SDK Active</span>.
              </p>
              <p className="text-[11px] text-[#15803D] mt-0.5">
                PatchFlow will now passively monitor your application for unhandled exceptions in real time, run root-cause analysis, and autonomously open GitHub Pull Requests.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E7E5E2] bg-[#FAFAF9] shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-[#A3A099]">You can re-open this guide at any time from your Sites dashboard.</span>
          <button onClick={onClose}
            className="px-5 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors cursor-pointer">
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [sites,             setSites]             = useState<Site[]>([]);
  const [repos,             setRepos]             = useState<Repo[]>([]);
  const [reposLoading,      setReposLoading]      = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [showForm,          setShowForm]          = useState(false);
  const [editSite,          setEditSite]          = useState<Site | null>(null);
  const [sdkSite,           setSdkSite]           = useState<{ site: Site; apiKey: string } | null>(null);
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<Site | null>(null);
  const [saving,            setSaving]            = useState(false);
  const [deletingId,        setDeletingId]        = useState<string | null>(null);
  const [error,             setError]             = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", url: "", github_repo: "", framework: "fastapi" });

  const loadSites = async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/sites");
      if (r.ok) setSites((await r.json()).sites ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const r = await authFetch("/api/auth/repos");
      if (r.ok) {
        const d = await r.json();
        setRepos(Array.isArray(d.repos) ? d.repos : []);
      }
    } catch (e) { console.error(e); }
    finally { setReposLoading(false); }
  };

  useEffect(() => { loadSites(); loadRepos(); }, []);

  const openCreate = () => {
    setEditSite(null);
    setForm({ name: "", url: "", github_repo: "", framework: "fastapi" });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    setEditSite(site);
    setForm({ name: site.name, url: site.url ?? "", github_repo: site.github_repo ?? "", framework: site.framework ?? "fastapi" });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Site name is required."); return; }
    if (!form.framework) { setError("Please select a supported framework."); return; }
    setSaving(true); setError(null);
    try {
      const body = { name: form.name.trim(), url: form.url.trim() || null, github_repo: form.github_repo || null, framework: form.framework || null };
      const path   = editSite ? `/api/sites/${editSite.id}` : `/api/sites`;
      const method = editSite ? "PATCH" : "POST";
      const r = await authFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Failed to save site.");
      const saved: Site = await r.json();
      setShowForm(false);
      await loadSites();
      // Show SDK setup on create (API key is in the response exactly once)
      if (!editSite && saved.api_key) {
        setSdkSite({ site: saved, apiKey: saved.api_key });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await authFetch(`/api/sites/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSites(p => p.filter(s => s.id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Failed to delete site.");
      }
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  const sdkStatusMeta = (status: string) => {
    switch (status) {
      case "active": return { label: "SDK Active", cls: "bg-[#F0FDF4] text-[#16A34A] border border-emerald-200", icon: Activity };
      case "offline": return { label: "SDK Offline", cls: "bg-[#FFFBEB] text-[#D97706] border border-amber-200", icon: AlertCircle };
      case "error":  return { label: "SDK Error",  cls: "bg-[#FEF2F2] text-[#DC2626] border border-red-200", icon: AlertCircle };
      default:       return { label: "Not installed", cls: "bg-[#F3F2F0] text-[#6F6B66] border border-zinc-200", icon: AlertCircle };
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 w-full">

      {/* SDK setup modal */}
      <AnimatePresence>
        {sdkSite && (
          <SdkSetupPanel
            site={sdkSite.site}
            apiKey={sdkSite.apiKey}
            onClose={() => { setSdkSite(null); }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-[800] text-[#111110] tracking-tight">Monitored Sites</h1>
          <p className="text-[14px] text-[#6F6B66] mt-0.5">
            Connect your backend services. PatchFlow captures production errors and opens verified fix PRs automatically.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors cursor-pointer">
          <Plus className="h-[14px] w-[14px]" /> Connect Site
        </button>
      </div>

      {/* Connect form modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs" onClick={() => setShowForm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-xl w-full max-w-[560px] p-6 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[17px] font-[700] text-[#111110]">{editSite ? "Edit Site Settings" : "Connect a Backend Service"}</h2>
                    <p className="text-[12px] text-[#6F6B66] mt-0.5">Configure your repository and select your backend framework.</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="text-[#A3A099] hover:text-[#111110] cursor-pointer p-1"><X className="h-[18px] w-[18px]" /></button>
                </div>

                {error && <p className="text-[12px] font-[600] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-3 py-2">{error}</p>}

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Site Name <span className="text-[#DC2626]">*</span></label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. payments-api"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">GitHub Repository</label>
                    <RepoDropdown value={form.github_repo} repos={repos} reposLoading={reposLoading} onChange={v => setForm(p => ({ ...p, github_repo: v }))} />
                    <p className="text-[11px] text-[#A3A099]">PatchFlow clones this repo to locate source code and open fix PRs.</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Production URL (Optional)</label>
                    <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://api.acme.com"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]" />
                  </div>

                  {/* Framework Selection Cards */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">
                      Backend Framework <span className="text-[#DC2626]">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {SUPPORTED_FRAMEWORKS.map(fw => {
                        const isSelected = form.framework === fw.id;
                        return (
                          <div
                            key={fw.id}
                            onClick={() => setForm(p => ({ ...p, framework: fw.id }))}
                            className={cn(
                              "p-3 rounded-[10px] border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 relative",
                              isSelected
                                ? "border-[#FF5A1F] bg-[#FFF8F5] shadow-xs ring-1 ring-[#FF5A1F]"
                                : "border-[#E7E5E2] bg-white hover:border-[#D4D1CC] hover:bg-[#FAFAF9]"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-[13px] font-[700] text-[#111110]">{fw.name}</span>
                              {isSelected && (
                                <div className="h-4 w-4 rounded-full bg-[#FF5A1F] text-white flex items-center justify-center">
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-[500] border", fw.badgeColor)}>
                                {fw.language}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[#6F6B66] mt-0.5">
                      Only officially supported backend engines are shown. Custom setup instructions will be provided immediately upon connection.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer">
                    {saving ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Check className="h-[14px] w-[14px]" />}
                    {editSite ? "Save Changes" : "Connect Site"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteSite && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteSite(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-2xl w-full max-w-[420px] p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
                    <Trash2 className="h-5 w-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-[700] text-[#111110]">Delete Site</h2>
                    <p className="text-[12px] text-[#6F6B66]">This action cannot be undone.</p>
                  </div>
                </div>

                <p className="text-[13px] text-[#374151] leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#111110] font-[700]">{confirmDeleteSite.name}</strong>? All associated API keys, incident logs, and SDK metrics will be permanently removed.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setConfirmDeleteSite(null)}
                    className="flex-1 py-2.5 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const id = confirmDeleteSite.id;
                      setConfirmDeleteSite(null);
                      await handleDelete(id);
                    }}
                    disabled={deletingId === confirmDeleteSite.id}
                    className="flex-1 py-2.5 text-[13px] font-[600] text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-[8px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {deletingId === confirmDeleteSite.id ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Trash2 className="h-[14px] w-[14px]" />}
                    Delete Site
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sites list */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-[#FF5A1F] animate-spin" /></div>
      ) : sites.length === 0 ? (
        <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-12 text-center">
          <Globe className="h-8 w-8 text-[#D4D1CC] mx-auto mb-3" />
          <p className="text-[14px] font-[600] text-[#111110]">No backend services connected yet</p>
          <p className="text-[13px] text-[#6F6B66] mt-1 mb-4">Connect your FastAPI, Express, Django, or Spring Boot API to enable autonomous error fixes.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] cursor-pointer">
            <Plus className="h-[14px] w-[14px]" /> Connect Site
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sites.map((site, i) => {
            const sdkMeta = sdkStatusMeta(site.sdk_status);
            const SdkIcon = sdkMeta.icon;
            const fwConfig = SUPPORTED_FRAMEWORKS.find(
              f => f.id === site.framework?.toLowerCase() || f.name.toLowerCase().includes(site.framework?.toLowerCase() || "")
            );

            return (
              <motion.div key={site.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="bg-white border border-[#E7E5E2] rounded-[14px] p-[18px_20px] hover:border-[#D4D1CC] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-[700] text-[#111110]">{site.name}</span>
                      <span className={cn("flex items-center gap-1 text-[10px] font-[700] uppercase px-[7px] py-[2px] rounded-full", sdkMeta.cls)}>
                        <SdkIcon className="h-[9px] w-[9px]" />
                        {sdkMeta.label}
                      </span>
                      <button
                        onClick={() => setSdkSite({ site, apiKey: site.api_keys[0]?.prefix ? `${site.api_keys[0].prefix}…` : "YOUR_API_KEY" })}
                        className="text-[11px] font-[600] text-[#FF5A1F] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        Setup Guide →
                      </button>
                    </div>
                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6F6B66]">
                      {site.url && (
                        <a href={site.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#111110]">
                          <Globe className="h-[11px] w-[11px]" />{site.url}<ExternalLink className="h-[10px] w-[10px]" />
                        </a>
                      )}
                      {site.github_repo && (
                        <a href={`https://github.com/${site.github_repo}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono hover:text-[#111110]">
                          {site.github_repo}<ExternalLink className="h-[10px] w-[10px]" />
                        </a>
                      )}
                      {site.framework && (
                        <span className={cn("px-[7px] py-[1px] rounded-[4px] font-[600] text-[11px] border", fwConfig?.badgeColor || "bg-[#F8FAFC] border-[#E2E8F0]")}>
                          {fwConfig?.name || site.framework}
                        </span>
                      )}
                      {site.sdk_last_seen && (
                        <span className="text-[#A3A099]">Last ping {timeAgo(site.sdk_last_seen)}</span>
                      )}
                    </div>
                    {/* API key prefix */}
                    {site.api_keys.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#A3A099]">
                        <Key className="h-[11px] w-[11px]" />
                        <span className="font-mono">{site.api_keys[0].prefix}…</span>
                        {site.api_keys[0].last_used_at && (
                          <span>· used {timeAgo(site.api_keys[0].last_used_at)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(site)} className="p-1.5 text-[#A3A099] hover:text-[#111110] hover:bg-[#F3F2F0] rounded-[6px] cursor-pointer">
                      <Pencil className="h-[14px] w-[14px]" />
                    </button>
                    <button onClick={() => setConfirmDeleteSite(site)} disabled={deletingId === site.id}
                      className="p-1.5 text-[#A3A099] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-[6px] disabled:opacity-50 cursor-pointer">
                      {deletingId === site.id ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Trash2 className="h-[14px] w-[14px]" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
