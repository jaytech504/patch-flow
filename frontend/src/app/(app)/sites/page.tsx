"use client";

import { useEffect, useRef, useState } from "react";
import {
  Globe, Plus, Trash2, Pencil, Loader2,
  Check, X, ExternalLink, Search, ChevronDown,
  Key, Copy, Terminal, ChevronRight, Activity,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

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

const FRAMEWORKS = [
  "fastapi", "flask", "nextjs", "express", "nestjs", "hono",
  "django", "rails", "other",
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
          : <span className={value ? "font-mono text-[#111110]" : "text-[#A3A099]"}>{value || "Select a repository"}</span>}
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
  const [tab, setTab] = useState<"node" | "python">("node");

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const liveHost = "https://patchflow-backend-xax6.onrender.com";
  const needsHost = API_BASE_URL !== liveHost;
  const hostParam = needsHost ? `,\n    host: '${API_BASE_URL}'` : "";
  const hostPyParam = needsHost ? `,\n    host="${API_BASE_URL}"` : "";

  const envSnippet = `PATCHFLOW_API_KEY=${apiKey}${needsHost ? `\nPATCHFLOW_HOST=${API_BASE_URL}` : ""}`;

  const nextInstrumentationCode = `// instrumentation.ts — place in project root (or src/)
import patchflow from './patchflow'; // or from '@/lib/patchflow'

export function register() {
  patchflow.init({
    apiKey: process.env.PATCHFLOW_API_KEY!${hostParam}
  });
}

// ⚡ Automatically intercepts all unhandled errors across all API routes & pages:
export async function onRequestError(err: any, request: any) {
  patchflow.captureException(err, {
    endpoint: request?.path || '',
    method: request?.method || 'GET',
    framework: 'nextjs',
  });
}`;

  const nextConfigCode = `// next.config.js (Required for Next.js 14)
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;`;

  const expressCode = `const patchflow = require('./patchflow');

patchflow.init({
  apiKey: process.env.PATCHFLOW_API_KEY${hostParam}
});

// ... your routes ...

// Add this AFTER all routes:
app.use(patchflow.expressMiddleware());`;

  const pythonCode = `import os
import patchflow

# Add to the top of your main.py:
patchflow.init(
    api_key=os.getenv("PATCHFLOW_API_KEY")${hostPyParam}
)`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-2xl w-full max-w-[620px] max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E7E5E2]">
          <div>
            <h2 className="text-[18px] font-[800] text-[#111110] tracking-tight">Connect {site.name}</h2>
            <p className="text-[13px] text-[#6F6B66] mt-0.5">Quick 3-step setup guide for your application</p>
          </div>
          <button onClick={onClose} className="text-[#A3A099] hover:text-[#111110] p-1.5 rounded-[6px] hover:bg-[#F3F2F0]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">

          {/* ── STEP 1: Add Environment Variable ────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">1</span>
              <span className="text-[14px] font-[700] text-[#111110]">Set your Environment Variable</span>
            </div>
            <p className="text-[12px] text-[#6F6B66] ml-7">
              Add this to your <code className="font-mono bg-[#F3F2F0] px-1.5 py-0.5 rounded text-[#111110]">.env.local</code> file and your hosting settings (e.g. Vercel / Render / Fly.io):
            </p>
            <div className="ml-7 relative">
              <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[12px_14px] rounded-[8px] overflow-x-auto">
                {envSnippet}
              </pre>
              <button onClick={() => copy("env", envSnippet)}
                className={cn("absolute top-2 right-2 flex items-center gap-1 text-[11px] font-[600] px-2 py-1 rounded-[5px] transition-colors",
                  copied === "env" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                {copied === "env" ? <><Check className="h-[11px] w-[11px]" />Copied</> : <><Copy className="h-[11px] w-[11px]" />Copy</>}
              </button>
            </div>
          </div>

          {/* ── STEP 2: Download SDK ────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">2</span>
              <span className="text-[14px] font-[700] text-[#111110]">Download the SDK File</span>
            </div>
            <div className="ml-7 flex flex-col gap-2">
              <div className="flex gap-2 bg-[#F3F2F0] rounded-[8px] p-1 w-fit">
                {(["node", "python"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={cn("px-3 py-1 text-[12px] font-[600] rounded-[6px] transition-colors",
                      tab === t ? "bg-white text-[#111110] shadow-xs" : "text-[#6F6B66] hover:text-[#111110]")}>
                    {t === "node" ? "Next.js / Node.js" : "FastAPI / Python"}
                  </button>
                ))}
              </div>

              {tab === "node" ? (
                <div className="flex items-center gap-3">
                  <a href="/sdk/patchflow.js" download="patchflow.js"
                    className="flex items-center gap-2 text-[12px] font-[700] text-white bg-[#111110] hover:bg-[#333] px-3.5 py-2 rounded-[8px] transition-colors">
                    <Terminal className="h-[13px] w-[13px]" /> Download patchflow.js
                  </a>
                  <span className="text-[12px] text-[#6F6B66]">Place in your project root or <code className="font-mono bg-[#F3F2F0] px-1 rounded">lib/</code></span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <a href="/sdk/patchflow.py" download="patchflow.py"
                    className="flex items-center gap-2 text-[12px] font-[700] text-white bg-[#111110] hover:bg-[#333] px-3.5 py-2 rounded-[8px] transition-colors">
                    <Terminal className="h-[13px] w-[13px]" /> Download patchflow.py
                  </a>
                  <span className="text-[12px] text-[#6F6B66]">Place in your project root next to <code className="font-mono bg-[#F3F2F0] px-1 rounded">main.py</code></span>
                </div>
              )}
            </div>
          </div>

          {/* ── STEP 3: Setup Code ──────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#FF5A1F] text-white text-[11px] font-[800]">3</span>
              <span className="text-[14px] font-[700] text-[#111110]">Initialize in your Code</span>
            </div>

            <div className="ml-7 flex flex-col gap-3">
              {tab === "node" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-[700] text-[#111110]">
                        Next.js: Create <code className="font-mono bg-[#F3F2F0] px-1 rounded text-[#FF5A1F]">instrumentation.ts</code>
                      </span>
                      <span className="text-[10px] font-[600] bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded-full">
                        Global — covers all routes automatically
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6F6B66] mb-1.5 leading-relaxed">
                      Place this in your project root (or <code className="font-mono text-[#111110]">src/</code>) — catches all server & API crashes across your entire app:
                    </p>
                    <div className="relative">
                      <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[12px_14px] rounded-[8px] overflow-x-auto leading-relaxed">
                        {nextInstrumentationCode}
                      </pre>
                      <button onClick={() => copy("next", nextInstrumentationCode)}
                        className={cn("absolute top-2 right-2 flex items-center gap-1 text-[11px] font-[600] px-2 py-1 rounded-[5px] transition-colors",
                          copied === "next" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                        {copied === "next" ? <Check className="h-[11px] w-[11px]" /> : <Copy className="h-[11px] w-[11px]" />}
                      </button>
                    </div>
                  </div>

                  {/* Next.js 14 Alert */}
                  <div className="p-3 bg-[#FFF8F5] border border-[#FFE2D5] rounded-[8px] flex flex-col gap-1.5">
                    <span className="text-[12px] font-[700] text-[#C2410C]">⚡ Using Next.js 14?</span>
                    <p className="text-[11px] text-[#7C2D12] leading-relaxed">
                      Next.js 14 requires enabling the instrumentation hook in <code className="font-mono font-[600] bg-[#FFEDE3] px-1 rounded">next.config.js</code> so it runs automatically on startup:
                    </p>
                    <div className="relative">
                      <pre className="bg-[#111110] text-[#F8F8F2] text-[11px] font-mono p-[10px_12px] rounded-[6px] overflow-x-auto">
                        {nextConfigCode}
                      </pre>
                      <button onClick={() => copy("config", nextConfigCode)}
                        className={cn("absolute top-2 right-2 flex items-center gap-1 text-[10px] font-[600] px-2 py-0.5 rounded-[4px] transition-colors",
                          copied === "config" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                        {copied === "config" ? <Check className="h-[10px] w-[10px]" /> : <Copy className="h-[10px] w-[10px]" />}
                      </button>
                    </div>
                  </div>

                  <details className="group border border-[#E7E5E2] rounded-[8px] p-3 bg-[#FAFAF9]">
                    <summary className="text-[12px] font-[700] text-[#374151] cursor-pointer hover:text-[#111110] select-none flex items-center justify-between">
                      <span>Using Express?</span>
                      <span className="text-[11px] text-[#A3A099] font-[500]">Middleware setup ▸</span>
                    </summary>
                    <div className="mt-2 relative">
                      <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[12px_14px] rounded-[6px] overflow-x-auto">
                        {expressCode}
                      </pre>
                      <button onClick={() => copy("express", expressCode)}
                        className={cn("absolute top-2 right-2 flex items-center gap-1 text-[11px] font-[600] px-2 py-1 rounded-[5px] transition-colors",
                          copied === "express" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                        {copied === "express" ? <Check className="h-[11px] w-[11px]" /> : <Copy className="h-[11px] w-[11px]" />}
                      </button>
                    </div>
                  </details>
                </div>
              )}

              {tab === "python" && (
                <div>
                  <span className="text-[12px] font-[600] text-[#111110] block mb-1">Add to the top of <code className="font-mono bg-[#F3F2F0] px-1 rounded">main.py</code>:</span>
                  <div className="relative">
                    <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] font-mono p-[12px_14px] rounded-[8px] overflow-x-auto leading-relaxed">
                      {pythonCode}
                    </pre>
                    <button onClick={() => copy("python", pythonCode)}
                      className={cn("absolute top-2 right-2 flex items-center gap-1 text-[11px] font-[600] px-2 py-1 rounded-[5px] transition-colors",
                        copied === "python" ? "bg-green-800 text-green-200" : "bg-white/10 text-white/70 hover:bg-white/20")}>
                      {copied === "python" ? <Check className="h-[11px] w-[11px]" /> : <Copy className="h-[11px] w-[11px]" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Status Banner ───────────────────────────────────────────── */}
          <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[10px] p-[14px_16px] flex flex-col gap-1.5">
            <span className="text-[12px] font-[700] text-[#16A34A] flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Automatic Verification
            </span>
            <p className="text-[12px] text-[#374151]">
              The moment your app starts up with PatchFlow initialized, it automatically sends a background ping. Your site status on this dashboard will turn <span className="font-[700] text-[#16A34A]">SDK Active</span> immediately!
            </p>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors cursor-pointer">
            Done — Close Guide
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

  const [form, setForm] = useState({ name: "", url: "", github_repo: "", framework: "" });

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("patchflow_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadSites = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/sites`, { headers: authHeaders() });
      if (r.ok) setSites((await r.json()).sites ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/auth/repos`, { headers: authHeaders() });
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
    setForm({ name: "", url: "", github_repo: "", framework: "" });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    setEditSite(site);
    setForm({ name: site.name, url: site.url ?? "", github_repo: site.github_repo ?? "", framework: site.framework ?? "" });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    try {
      const body = { name: form.name.trim(), url: form.url.trim() || null, github_repo: form.github_repo || null, framework: form.framework || null };
      const url    = editSite ? `${API_BASE_URL}/api/sites/${editSite.id}` : `${API_BASE_URL}/api/sites`;
      const method = editSite ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
      const res = await fetch(`${API_BASE_URL}/api/sites/${id}`, { method: "DELETE", headers: authHeaders() });
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
      case "active": return { label: "SDK Active", cls: "bg-[#F0FDF4] text-[#16A34A]", icon: Activity };
      case "error":  return { label: "SDK Error",  cls: "bg-[#FEF2F2] text-[#DC2626]", icon: AlertCircle };
      default:       return { label: "Not installed", cls: "bg-[#F3F2F0] text-[#6F6B66]", icon: AlertCircle };
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
            Connect your apps. PatchFlow captures real errors and opens fix PRs automatically.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors">
          <Plus className="h-[14px] w-[14px]" /> Connect Site
        </button>
      </div>

      {/* Connect form modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-xl w-full max-w-[480px] p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-[700] text-[#111110]">{editSite ? "Edit Site" : "Connect a Site"}</h2>
                  <button onClick={() => setShowForm(false)} className="text-[#A3A099] hover:text-[#111110]"><X className="h-[18px] w-[18px]" /></button>
                </div>
                {error && <p className="text-[12px] font-[600] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-3 py-2">{error}</p>}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Site Name <span className="text-[#DC2626]">*</span></label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. payments-api"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Production URL</label>
                    <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://api.acme.com"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">GitHub Repository</label>
                    <RepoDropdown value={form.github_repo} repos={repos} reposLoading={reposLoading} onChange={v => setForm(p => ({ ...p, github_repo: v }))} />
                    <p className="text-[11px] text-[#A3A099]">PatchFlow clones this repo to generate and open fix PRs.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Framework</label>
                    <select value={form.framework} onChange={e => setForm(p => ({ ...p, framework: e.target.value }))}
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]">
                      <option value="">— Auto-detect from repo —</option>
                      {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] flex items-center justify-center gap-1.5 disabled:opacity-60">
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
                    className="flex-1 py-2.5 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors"
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
                    className="flex-1 py-2.5 text-[13px] font-[600] text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-[8px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
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
          <p className="text-[14px] font-[600] text-[#111110]">No sites connected yet</p>
          <p className="text-[13px] text-[#6F6B66] mt-1 mb-4">Connect your first app to start receiving automated incident fixes.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px]">
            <Plus className="h-[14px] w-[14px]" /> Connect Site
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sites.map((site, i) => {
            const sdkMeta = sdkStatusMeta(site.sdk_status);
            const SdkIcon = sdkMeta.icon;
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
                      {site.sdk_status !== "active" && (
                        <button onClick={() => setSdkSite({ site, apiKey: site.api_keys[0]?.prefix + "…" })}
                          className="text-[11px] font-[600] text-[#FF5A1F] hover:underline">
                          Setup SDK →
                        </button>
                      )}
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
                        <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-[6px] py-[1px] rounded-[4px] font-[500]">{site.framework}</span>
                      )}
                      {site.sdk_last_seen && (
                        <span className="text-[#A3A099]">Last seen {timeAgo(site.sdk_last_seen)}</span>
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
                    <button onClick={() => openEdit(site)} className="p-1.5 text-[#A3A099] hover:text-[#111110] hover:bg-[#F3F2F0] rounded-[6px]">
                      <Pencil className="h-[14px] w-[14px]" />
                    </button>
                    <button onClick={() => setConfirmDeleteSite(site)} disabled={deletingId === site.id}
                      className="p-1.5 text-[#A3A099] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-[6px] disabled:opacity-50">
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
