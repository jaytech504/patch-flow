"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Globe, Plus, Trash2, Pencil, Loader2,
  Check, X, ExternalLink, Search, ChevronDown,
  Key, Copy, Activity,
  AlertCircle, Download, CheckCircle2,
  Zap, FileCode, RefreshCw, ArrowRight,
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

export interface CodeBlock {
  label: string;
  file: string;
  code: string;
}

export interface FrameworkConfig {
  id: string;
  name: string;
  language: string;
  tag: string;
  badgeColor: string;
  description: string;
  downloadFile: string;
  downloadFilename: string;
  placementPath: string;
  targetFile: string;
  setupSummary: string;
  importantNote?: string;
  codeBlocks: (apiKey: string, apiHost: string) => CodeBlock[];
}

export const SUPPORTED_FRAMEWORKS: FrameworkConfig[] = [
  {
    id: "fastapi",
    name: "FastAPI",
    language: "Python",
    tag: "Async / ASGI",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    description: "Captures unhandled exceptions across all async routes automatically.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementPath: "your-project/\n├── main.py\n└── patchflow.py  ← here",
    targetFile: "main.py",
    setupSummary: "Add two lines after creating your FastAPI app. The SDK auto-installs ASGI middleware — no route changes needed.",
    importantNote: "Do not wrap individual routes. One init call covers your entire API.",
    codeBlocks: (_apiKey, apiHost) => [{
      label: "Add to your main entry file",
      file: "main.py",
      code: `import os
from fastapi import FastAPI
import patchflow

app = FastAPI()

# Initialise PatchFlow — auto-installs ASGI middleware on your app
patchflow.init(
    api_key=os.environ["PATCHFLOW_API_KEY"],
    host=os.getenv("PATCHFLOW_HOST", "${apiHost}"),
)

# ... your routes stay exactly as they are ...`,
    }],
  },
  {
    id: "express",
    name: "Express.js",
    language: "Node.js",
    tag: "JavaScript / TypeScript",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Captures sync and async route handler crashes via error middleware.",
    downloadFile: "/sdk/patchflow.js",
    downloadFilename: "patchflow.js",
    placementPath: "your-project/\n├── server.js\n└── patchflow.js  ← here",
    targetFile: "server.js",
    setupSummary: "Init at the top of your server file, then add error middleware once at the bottom — after all routes.",
    importantNote: "Never add middleware per-route. One app.use() at the bottom covers everything.",
    codeBlocks: (_apiKey, apiHost) => [
      {
        label: "Step A — top of file",
        file: "server.js",
        code: `const express = require('express');
const patchflow = require('./patchflow');

const app = express();

patchflow.init({
  apiKey: process.env.PATCHFLOW_API_KEY,
  host: process.env.PATCHFLOW_HOST || '${apiHost}',
});`,
      },
      {
        label: "Step B — bottom of file, after all routes",
        file: "server.js",
        code: `// ... all your existing routes above ...

app.use(patchflow.expressMiddleware());

app.listen(4000);`,
      },
    ],
  },
  {
    id: "django",
    name: "Django / DRF",
    language: "Python",
    tag: "Django 4+ / 5+",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Captures unhandled view exceptions and DRF crashes project-wide.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementPath: "your-project/\n├── manage.py\n├── patchflow.py  ← here\n└── config/\n    └── settings.py",
    targetFile: "config/settings.py",
    setupSummary: "Add middleware to MIDDLEWARE, then call init at the bottom of settings.py.",
    importantNote: "Put PatchFlowDjangoMiddleware at the top of MIDDLEWARE so it wraps all views.",
    codeBlocks: (_apiKey, apiHost) => [
      {
        label: "Add middleware near the top of MIDDLEWARE",
        file: "config/settings.py",
        code: `MIDDLEWARE = [
    'patchflow.PatchFlowDjangoMiddleware',  # ← add this line first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    # ... rest of your middleware ...
]`,
      },
      {
        label: "Initialise at the bottom of settings.py",
        file: "config/settings.py",
        code: `import os
import patchflow

patchflow.init(
    api_key=os.environ["PATCHFLOW_API_KEY"],
    host=os.getenv("PATCHFLOW_HOST", "${apiHost}"),
)`,
      },
    ],
  },
  {
    id: "springboot",
    name: "Spring Boot",
    language: "Java",
    tag: "Java 17+ / Spring 3+",
    badgeColor: "bg-green-50 text-green-700 border-green-200",
    description: "Drop-in @RestControllerAdvice — zero extra dependencies.",
    downloadFile: "/sdk/PatchFlowAdvice.java",
    downloadFilename: "PatchFlowAdvice.java",
    placementPath: "src/main/java/com/yourpackage/\n└── PatchFlowAdvice.java  ← here",
    targetFile: "PatchFlowAdvice.java",
    setupSummary: "Drop the file into your package, update the package declaration, and set env vars. Spring Boot auto-detects it.",
    importantNote: "No Maven or Gradle dependencies needed. Uses Java 11+ HttpClient built into the JDK.",
    codeBlocks: (_apiKey, _apiHost) => [{
      label: "Update the package declaration to match your project",
      file: "PatchFlowAdvice.java (line 1)",
      code: `// Change this line to your actual package:
package com.yourcompany.yourapp;

// The rest of the file stays as downloaded.
// Spring Boot auto-registers @RestControllerAdvice — no config needed.`,
    }],
  },
  {
    id: "flask",
    name: "Flask",
    language: "Python",
    tag: "WSGI / Sync",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Captures 500 errors across all routes and blueprints.",
    downloadFile: "/sdk/patchflow.py",
    downloadFilename: "patchflow.py",
    placementPath: "your-project/\n├── app.py\n└── patchflow.py  ← here",
    targetFile: "app.py",
    setupSummary: "Pass your Flask app instance to init once. All routes and blueprints are covered automatically.",
    importantNote: "Do not add error handlers per-route. One init call covers your entire app.",
    codeBlocks: (_apiKey, apiHost) => [{
      label: "Add after creating your Flask app",
      file: "app.py",
      code: `import os
from flask import Flask
import patchflow

app = Flask(__name__)

patchflow.init(
    api_key=os.environ["PATCHFLOW_API_KEY"],
    host=os.getenv("PATCHFLOW_HOST", "${apiHost}"),
    app=app,
)

# ... your routes and blueprints stay unchanged ...`,
    }],
  },
];

function resolveFramework(site: Site): FrameworkConfig {
  return SUPPORTED_FRAMEWORKS.find(
    f => f.id === site.framework?.toLowerCase() ||
      f.name.toLowerCase().includes(site.framework?.toLowerCase() || "")
  ) || SUPPORTED_FRAMEWORKS[0];
}

function isMaskedApiKey(key: string): boolean {
  return key.includes("…") || key === "YOUR_API_KEY" || key.endsWith("...");
}

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

// ── Copyable code block ───────────────────────────────────────────────────────

function CopyBlock({ id, code, copied, onCopy }: {
  id: string; code: string; copied: string | null; onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="relative">
      <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[14px_16px] pr-[72px] rounded-[8px] overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
        {code}
      </pre>
      <button type="button" onClick={() => onCopy(id, code)}
        className={cn("absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-[600] px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer z-10",
          copied === id ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
        {copied === id ? <><Check className="h-[11px] w-[11px]" />Copied</> : <><Copy className="h-[11px] w-[11px]" />Copy</>}
      </button>
    </div>
  );
}

async function downloadSdkFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function ConnectSiteModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useBodyScrollLock(true);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain">
        <div
          className="min-h-full flex items-start justify-center p-4 sm:p-8 bg-black/30"
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[560px] my-4"
          >
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function SetupStepCard({ step, title, icon: Icon, children }: {
  step: number; title: string; icon: ElementType; children: ReactNode;
}) {
  return (
    <div className="border border-[#E7E5E2] rounded-[12px]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#FAFAF9] border-b border-[#E7E5E2] rounded-t-[12px]">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800] shrink-0">
          {step}
        </span>
        <Icon className="h-4 w-4 text-[#FF5A1F] shrink-0" />
        <span className="text-[14px] font-[700] text-[#111110]">{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-3 bg-white rounded-b-[12px]">{children}</div>
    </div>
  );
}

// ── SDK Setup Panel ───────────────────────────────────────────────────────────

function SdkSetupPanel({ site, apiKey: initialApiKey, onClose, onRefreshStatus, onApiKeyChange }: {
  site: Site;
  apiKey: string;
  onClose: () => void;
  onRefreshStatus: () => Promise<Site | null>;
  onApiKeyChange: (key: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "active" | "pending">("idle");

  const fw = resolveFramework(site);
  const apiHost = API_BASE_URL.replace(/\/$/, "");
  const masked = isMaskedApiKey(apiKey);
  const envSnippet = `PATCHFLOW_API_KEY=${masked ? "your_api_key_here" : apiKey}\nPATCHFLOW_HOST=${apiHost}`;
  const blocks = fw.codeBlocks(masked ? "your_api_key_here" : apiKey, apiHost);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const generateKey = async () => {
    setGeneratingKey(true);
    try {
      const r = await authFetch(`/api/sites/${site.id}/generate-key`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to generate key");
      const data = await r.json();
      setApiKey(data.api_key);
      onApiKeyChange(data.api_key);
    } catch {
      alert("Could not generate a new API key. Please try again.");
    } finally {
      setGeneratingKey(false);
    }
  };

  const checkConnection = async () => {
    setCheckingConnection(true);
    const refreshed = await onRefreshStatus();
    setConnectionStatus(refreshed?.sdk_status === "active" ? "active" : "pending");
    setCheckingConnection(false);
  };

  useBodyScrollLock(true);

  return (
    <ModalPortal>
      {/* Scroll the overlay itself — avoids flex max-height scroll bugs */}
      <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain">
        <div
          className="min-h-full flex items-start justify-center p-4 sm:p-8 bg-black/40"
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sdk-setup-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[680px] my-4 bg-white rounded-[16px] border border-[#E7E5E2] shadow-2xl"
          >

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E7E5E2]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="sdk-setup-title" className="text-[18px] font-[800] text-[#111110] tracking-tight">
                  Set up {fw.name}
                </h2>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-[600] border", fw.badgeColor)}>
                  {fw.language}
                </span>
              </div>
              <p className="text-[13px] text-[#6F6B66] mt-1">
                Follow these 4 steps to connect <strong className="text-[#111110] font-[600]">{site.name}</strong>.
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-[#A3A099] hover:text-[#111110] p-1.5 rounded-[6px] hover:bg-[#F3F2F0] transition-colors shrink-0 cursor-pointer">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <p className="text-[12px] text-[#475569] mt-3 leading-relaxed">{fw.setupSummary}</p>
        </div>

        {/* Steps */}
        <div className="p-6 flex flex-col gap-4">

          {/* Step 1 — Download */}
          <SetupStepCard step={1} title="Download the SDK file" icon={Download}>
            <button
              type="button"
              onClick={() => downloadSdkFile(fw.downloadFile, fw.downloadFilename)}
              className="inline-flex items-center gap-2 text-[12px] font-[700] text-white bg-[#111110] hover:bg-[#333] px-4 py-2.5 rounded-[8px] transition-colors w-fit cursor-pointer"
            >
              <Download className="h-[13px] w-[13px]" />
              Download {fw.downloadFilename}
            </button>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3">
              <p className="text-[11px] font-[600] text-[#6F6B66] uppercase tracking-wide mb-2">Place it here</p>
              <pre className="text-[12px] font-mono text-[#111110] leading-relaxed whitespace-pre-wrap">{fw.placementPath}</pre>
            </div>
          </SetupStepCard>

          {/* Step 2 — Env vars */}
          <SetupStepCard step={2} title="Set environment variables" icon={Key}>
            <p className="text-[12px] text-[#6F6B66] leading-relaxed">
              Add these to your <code className="font-mono bg-[#F3F2F0] px-1.5 py-0.5 rounded text-[#111110]">.env</code> file
              or your hosting dashboard (Render, Railway, Fly.io, etc.).
            </p>

            {masked && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#92400E] leading-relaxed">
                    Your full API key is only shown once at site creation. Generate a new key to copy it here.
                  </p>
                  <button type="button" onClick={generateKey} disabled={generatingKey}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-[600] text-[#92400E] hover:text-[#78350F] cursor-pointer disabled:opacity-60">
                    {generatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Generate new API key
                  </button>
                </div>
              </div>
            )}

            <CopyBlock id="env" code={envSnippet} copied={copied} onCopy={copy} />
          </SetupStepCard>

          {/* Step 3 — Code */}
          <SetupStepCard step={3} title="Add to your code" icon={FileCode}>
            {blocks.map((block, i) => (
              <div key={i} className="flex flex-col gap-2">
                {blocks.length > 1 && (
                  <p className="text-[12px] font-[600] text-[#374151]">{block.label}</p>
                )}
                <div className="flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5 text-[#FF5A1F]" />
                  <code className="text-[11px] font-mono text-[#6F6B66] bg-[#F3F2F0] px-2 py-0.5 rounded">{block.file}</code>
                </div>
                <CopyBlock id={`code-${i}`} code={block.code} copied={copied} onCopy={copy} />
              </div>
            ))}

            {fw.importantNote && (
              <div className="bg-[#FFF8F5] border border-[#FFE2D5] rounded-[8px] p-3 text-[12px] text-[#9A3412] leading-relaxed flex items-start gap-2">
                <Zap className="h-4 w-4 text-[#FF5A1F] shrink-0 mt-0.5" />
                <span><strong>Tip:</strong> {fw.importantNote}</span>
              </div>
            )}
          </SetupStepCard>

          {/* Step 4 — Verify */}
          <SetupStepCard step={4} title="Restart & verify connection" icon={Activity}>
            <p className="text-[12px] text-[#6F6B66] leading-relaxed">
              Restart your backend so the SDK initialises. On startup it sends a heartbeat automatically —
              your site status will change to <strong className="text-[#16A34A]">SDK Active</strong>.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={checkConnection} disabled={checkingConnection}
                className="inline-flex items-center gap-2 text-[12px] font-[700] text-white bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 rounded-[8px] transition-colors disabled:opacity-60 cursor-pointer">
                {checkingConnection
                  ? <><Loader2 className="h-[13px] w-[13px] animate-spin" />Checking…</>
                  : <><Activity className="h-[13px] w-[13px]" />Check connection</>}
              </button>
              {site.sdk_status === "active" && connectionStatus === "idle" && (
                <span className="flex items-center gap-1.5 text-[12px] font-[600] text-[#16A34A]">
                  <CheckCircle2 className="h-4 w-4" /> Already connected
                </span>
              )}
            </div>

            {connectionStatus === "active" && (
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[8px] p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
                <p className="text-[12px] text-[#166534] font-[600]">Connected — PatchFlow received your SDK heartbeat.</p>
              </div>
            )}
            {connectionStatus === "pending" && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#92400E] leading-relaxed">
                  No heartbeat yet. Double-check your env vars and code, restart the server, then try again.
                </p>
              </div>
            )}
          </SetupStepCard>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E7E5E2] bg-[#FAFAF9] rounded-b-[16px] flex items-center justify-between gap-4">
          <span className="text-[11px] text-[#A3A099]">Re-open this guide anytime via Setup Guide on your dashboard.</span>
          <button type="button" onClick={onClose}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors cursor-pointer shrink-0">
            Done <ArrowRight className="h-[13px] w-[13px]" />
          </button>
        </div>
          </div>
        </div>
      </div>
    </ModalPortal>
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
      // Open setup after connect form unmounts so overlays don't stack
      if (!editSite && saved.api_key) {
        requestAnimationFrame(() => {
          setSdkSite({ site: saved, apiKey: saved.api_key! });
        });
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

  const refreshSiteStatus = async (): Promise<Site | null> => {
    if (!sdkSite) return null;
    try {
      const r = await authFetch("/api/sites");
      if (!r.ok) return null;
      const list: Site[] = (await r.json()).sites ?? [];
      const updated = list.find(s => s.id === sdkSite.site.id) ?? null;
      if (updated) {
        setSites(list);
        setSdkSite(prev => prev ? { ...prev, site: updated } : null);
      }
      return updated;
    } catch {
      return null;
    }
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
            onRefreshStatus={refreshSiteStatus}
            onApiKeyChange={(key) => setSdkSite(prev => prev ? { ...prev, apiKey: key } : null)}
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
          <ConnectSiteModal onClose={() => setShowForm(false)}>
              <div className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-xl w-full max-w-[560px] p-6 flex flex-col gap-5 max-h-[min(90vh,720px)] overflow-y-auto overscroll-contain">
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
                    <div className="flex flex-col gap-2">
                      {SUPPORTED_FRAMEWORKS.map(fw => {
                        const isSelected = form.framework === fw.id;
                        return (
                          <div
                            key={fw.id}
                            onClick={() => setForm(p => ({ ...p, framework: fw.id }))}
                            className={cn(
                              "px-3.5 py-3 rounded-[10px] border text-left cursor-pointer transition-all flex items-center gap-3",
                              isSelected
                                ? "border-[#FF5A1F] bg-[#FFF8F5] ring-1 ring-[#FF5A1F]"
                                : "border-[#E7E5E2] bg-white hover:border-[#D4D1CC] hover:bg-[#FAFAF9]"
                            )}
                          >
                            <div className={cn(
                              "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                              isSelected ? "border-[#FF5A1F] bg-[#FF5A1F]" : "border-[#D4D1CC]"
                            )}>
                              {isSelected && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-[700] text-[#111110]">{fw.name}</span>
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-[500] border", fw.badgeColor)}>
                                  {fw.language}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#6F6B66] mt-0.5 truncate">{fw.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[#A3A099]">
                      Tailored setup steps appear right after you connect.
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
          </ConnectSiteModal>
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
