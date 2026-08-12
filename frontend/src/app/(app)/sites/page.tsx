"use client";

import { useEffect, useState } from "react";
import {
  Globe, Plus, Trash2, Pencil, Loader2,
  Check, X, ChevronDown, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  url: string | null;
  github_repo: string | null;
  sentry_project_slug: string | null;
  sentry_org: string | null;
  framework: string | null;
  active: boolean;
  created_at: string;
}

interface SentryProject {
  slug: string;
  name: string;
  platform: string;
}

const FRAMEWORKS = [
  "fastapi", "flask", "nextjs", "express", "nestjs", "hono",
  "django", "rails", "other",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [sites,           setSites]           = useState<Site[]>([]);
  const [sentryProjects,  setSentryProjects]  = useState<SentryProject[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [editSite,        setEditSite]        = useState<Site | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", url: "", github_repo: "",
    sentry_project_slug: "", framework: "",
  });

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("patchflow_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Load sites + Sentry projects
  const load = async () => {
    setLoading(true);
    try {
      const [sitesRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sites`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/api/sites/sentry-projects`, { headers: authHeaders() }),
      ]);
      if (sitesRes.ok) {
        const d = await sitesRes.json();
        setSites(d.sites ?? []);
      }
      if (projectsRes.ok) {
        const d = await projectsRes.json();
        setSentryProjects(d.projects ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditSite(null);
    setForm({ name: "", url: "", github_repo: "", sentry_project_slug: "", framework: "" });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    setEditSite(site);
    setForm({
      name: site.name,
      url: site.url ?? "",
      github_repo: site.github_repo ?? "",
      sentry_project_slug: site.sentry_project_slug ?? "",
      framework: site.framework ?? "",
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        url: form.url.trim() || null,
        github_repo: form.github_repo.trim() || null,
        sentry_project_slug: form.sentry_project_slug.trim() || null,
        framework: form.framework || null,
      };
      const url = editSite
        ? `${API_BASE_URL}/api/sites/${editSite.id}`
        : `${API_BASE_URL}/api/sites`;
      const method = editSite ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to save site.");
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE_URL}/api/sites/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setSites(p => p.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-[800] text-[#111110] tracking-tight">Monitored Sites</h1>
          <p className="text-[14px] text-[#6F6B66] mt-0.5">
            Connect your apps to PatchFlow. When Sentry fires, we fix it.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors"
        >
          <Plus className="h-[14px] w-[14px]" />
          Connect Site
        </button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-[16px] border border-[#E7E5E2] shadow-xl w-full max-w-[480px] p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-[700] text-[#111110]">
                    {editSite ? "Edit Site" : "Connect a Site"}
                  </h2>
                  <button onClick={() => setShowForm(false)} className="text-[#A3A099] hover:text-[#111110]">
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                {error && (
                  <p className="text-[12px] font-[600] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">
                      Site Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. payments-api"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F] focus:border-[#FF5A1F]"
                    />
                  </div>

                  {/* URL */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Production URL</label>
                    <input
                      value={form.url}
                      onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                      placeholder="https://api.acme.com"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FF5A1F] focus:border-[#FF5A1F]"
                    />
                  </div>

                  {/* GitHub Repo */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">GitHub Repo</label>
                    <input
                      value={form.github_repo}
                      onChange={e => setForm(p => ({ ...p, github_repo: e.target.value }))}
                      placeholder="owner/repo"
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-[#FF5A1F] focus:border-[#FF5A1F]"
                    />
                  </div>

                  {/* Sentry Project */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Sentry Project</label>
                    {sentryProjects.length > 0 ? (
                      <select
                        value={form.sentry_project_slug}
                        onChange={e => setForm(p => ({ ...p, sentry_project_slug: e.target.value }))}
                        className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]"
                      >
                        <option value="">— Select a project —</option>
                        {sentryProjects.map(p => (
                          <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.sentry_project_slug}
                        onChange={e => setForm(p => ({ ...p, sentry_project_slug: e.target.value }))}
                        placeholder="my-project-slug"
                        className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]"
                      />
                    )}
                    {sentryProjects.length === 0 && (
                      <p className="text-[11px] text-[#A3A099]">
                        Add SENTRY_AUTH_TOKEN + SENTRY_ORG to your .env to auto-populate projects.
                      </p>
                    )}
                  </div>

                  {/* Framework */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-[600] text-[#6F6B66] uppercase tracking-[0.04em]">Framework</label>
                    <select
                      value={form.framework}
                      onChange={e => setForm(p => ({ ...p, framework: e.target.value }))}
                      className="px-3 py-2 border border-[#E7E5E2] rounded-[8px] text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]"
                    >
                      <option value="">— Auto-detect —</option>
                      {FRAMEWORKS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Check className="h-[14px] w-[14px]" />}
                    {editSite ? "Save Changes" : "Connect Site"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sites list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-[#FF5A1F] animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-12 text-center">
          <Globe className="h-8 w-8 text-[#D4D1CC] mx-auto mb-3" />
          <p className="text-[14px] font-[600] text-[#111110]">No sites connected yet</p>
          <p className="text-[13px] text-[#6F6B66] mt-1 mb-4">
            Connect your first site to start monitoring production incidents.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-[600] text-white bg-[#FF5A1F] hover:bg-[#E04E16] rounded-[8px] transition-colors"
          >
            <Plus className="h-[14px] w-[14px]" /> Connect Site
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sites.map((site, i) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="bg-white border border-[#E7E5E2] rounded-[14px] p-[18px_20px] hover:border-[#D4D1CC] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-[700] text-[#111110]">{site.name}</span>
                    <span className={cn(
                      "text-[10px] font-[700] uppercase px-[6px] py-[2px] rounded-full",
                      site.active ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F3F2F0] text-[#6F6B66]"
                    )}>
                      {site.active ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6F6B66]">
                    {site.url && (
                      <a href={site.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 hover:text-[#111110] transition-colors">
                        <Globe className="h-[11px] w-[11px]" />{site.url}
                        <ExternalLink className="h-[10px] w-[10px]" />
                      </a>
                    )}
                    {site.github_repo && (
                      <span className="font-mono">{site.github_repo}</span>
                    )}
                    {site.sentry_project_slug && (
                      <span>Sentry: <span className="font-mono">{site.sentry_project_slug}</span></span>
                    )}
                    {site.framework && (
                      <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-[6px] py-[1px] rounded-[4px] font-[500]">
                        {site.framework}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(site)}
                    className="p-1.5 text-[#A3A099] hover:text-[#111110] hover:bg-[#F3F2F0] rounded-[6px] transition-colors"
                  >
                    <Pencil className="h-[14px] w-[14px]" />
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    disabled={deletingId === site.id}
                    className="p-1.5 text-[#A3A099] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-[6px] transition-colors disabled:opacity-50"
                  >
                    {deletingId === site.id
                      ? <Loader2 className="h-[14px] w-[14px] animate-spin" />
                      : <Trash2 className="h-[14px] w-[14px]" />
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
