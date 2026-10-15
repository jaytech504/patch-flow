"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Play, 
  Loader2, 
  Search, 
  ArrowLeft, 
  Upload, 
  FileText, 
  Check, 
  Plus, 
  Trash,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Lightbulb
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";
import { authFetch } from "@/lib/auth-fetch";
import { buttonVariants } from "@/components/ui/button";

interface Repo {
  name: string;
  full_name: string;
}

interface ManualEndpoint {
  path: string;
  method: string;
  description: string;
}

export default function NewSessionPage() {
  const router = useRouter();

  // Form states
  const [appName, setAppName] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [apiType, setApiType] = useState("openapi");
  const [openapiUrl, setOpenapiUrl] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  // File uploads
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [collectionFile, setCollectionFile] = useState<File | null>(null);
  const [isDragOverSpec, setIsDragOverSpec] = useState(false);
  const [isDragOverCollection, setIsDragOverCollection] = useState(false);

  // Manual endpoints
  const [manualEndpoints, setManualEndpoints] = useState<ManualEndpoint[]>([]);
  const [newMethod, setNewMethod] = useState("GET");
  const [newPath, setNewPath] = useState("");

  // GitHub Repos loading/search states
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form validation/submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New step/selection states
  const [step, setStep] = useState<"form" | "select">("form");
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [hoveredTempId, setHoveredTempId] = useState<string | null>(null);

  // Fetch repos on mount
  useEffect(() => {
    const fetchRepos = async () => {
      setReposLoading(true);
      try {
        const response = await authFetch("/api/auth/repos");
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.repos)) {
            setRepos(data.repos);
          } else if (Array.isArray(data)) {
            setRepos(data);
          }
        }
      } catch (err) {
        console.warn("Could not fetch real repos, using mock fallback list.", err);
        setRepos([
          { name: "payments-api", full_name: "acme/payments-api" },
          { name: "user-service", full_name: "acme/user-service" },
          { name: "notification-api", full_name: "acme/notification-api" },
          { name: "inventory-api", full_name: "acme/inventory-api" },
          { name: "auth-service", full_name: "acme/auth-service" },
          { name: "analytics-api", full_name: "acme/analytics-api" },
        ]);
      } finally {
        setReposLoading(false);
      }
    };

    fetchRepos();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const addManualEndpoint = () => {
    if (!newPath) return;
    const pathFormatted = newPath.startsWith("/") ? newPath : `/${newPath}`;
    setManualEndpoints((prev) => [
      ...prev,
      { method: newMethod, path: pathFormatted, description: `Manual entry: ${newMethod} ${pathFormatted}` },
    ]);
    setNewPath("");
  };

  const removeManualEndpoint = (index: number) => {
    setManualEndpoints((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Preview API handler (Step 1 -> Step 2)
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName || !appUrl) {
      setError("Please fill in the app name and URL.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let response: Response;
      
      if (apiType === "openapi") {
        if (!openapiUrl) throw new Error("Please specify the OpenAPI spec URL.");
        response = await authFetch("/api/discovery/preview/spec-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spec_url: openapiUrl,
          }),
        });
      } else if (apiType === "upload") {
        if (!specFile) throw new Error("Please select an OpenAPI file.");
        const formData = new FormData();
        formData.append("spec_file", specFile);

        response = await authFetch("/api/discovery/preview/spec-file", {
          method: "POST",
          body: formData,
        });
      } else if (apiType === "postman") {
        if (!collectionFile) throw new Error("Please select a Postman Collection file.");
        const formData = new FormData();
        formData.append("collection_file", collectionFile);

        response = await authFetch("/api/discovery/preview/postman", {
          method: "POST",
          body: formData,
        });
      } else {
        // Manual
        if (manualEndpoints.length === 0) throw new Error("Please add at least one endpoint.");
        response = await authFetch("/api/discovery/preview/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoints: manualEndpoints.map(ep => ({
              path: ep.path,
              method: ep.method,
              description: ep.description || "",
              payload: null
            })),
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to parse specification.");
      }

      const previewResult = await response.json();
      if (previewResult && previewResult.draft_id) {
        setPreviewData(previewResult);
        
        // Pre-select recommended endpoints by default
        const initialSelected = new Set<string>();
        if (previewResult.groups) {
          previewResult.groups.forEach((g: any) => {
            g.endpoints.forEach((ep: any) => {
              if (ep.recommended) {
                initialSelected.add(ep.temp_id);
              }
            });
          });
        }
        setSelectedTempIds(initialSelected);
        setStep("select");
      } else {
        throw new Error("No draft ID returned from preview backend.");
      }
    } catch (err: any) {
      console.error("Preview request failed:", err);
      setError(err.message || "Failed to preview endpoints. Please check your API URL and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run Session API handler (Step 2 -> Start)
  const handleStartSession = async () => {
    if (selectedTempIds.size === 0) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authFetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_id: previewData?.draft_id,
          target_url: appUrl,
          target_name: appName,
          github_repo: selectedRepo?.full_name || null,
          selected_temp_ids: Array.from(selectedTempIds),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start session.");
      }

      const result = await response.json();
      if (result && result.session_id) {
        router.push(`/sessions/${result.session_id}`);
      } else {
        throw new Error("No session ID returned from backend.");
      }
    } catch (err: any) {
      console.error("Start session failed:", err);
      setError(err.message || "Failed to start session. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("mx-auto px-6 py-12 w-full flex flex-col bg-background min-h-[calc(100vh-4rem)]", step === "form" ? "max-w-4xl" : "max-w-5xl")}>
      {step === "form" ? (
        <>
          {/* Back to Dashboard */}
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="text-[13px] font-semibold text-primary hover:text-[#E04E16] flex items-center gap-1.5 w-fit apple-press-subtle"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="apple-title-2 text-foreground">Run New Test</h1>
            <p className="apple-body text-text-secondary text-[13px] mt-1">
              Configure endpoint failure injection scans against your backend API target.
            </p>
          </div>

          {/* Supported Backend Frameworks Banner */}
          <div className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="apple-caption text-foreground">
                Supported Backend Frameworks
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className="bg-card text-foreground border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium py-0.5">
                🚀 FastAPI (Python)
              </Badge>
              <Badge variant="outline" className="bg-card text-foreground border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium py-0.5">
                🐍 Django & DRF (Python)
              </Badge>
              <Badge variant="outline" className="bg-card text-foreground border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium py-0.5">
                ⚡ Express.js (Node.js)
              </Badge>
              <Badge variant="outline" className="bg-card text-foreground border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium py-0.5">
                ☕ Spring Boot (Java)
              </Badge>
              <Badge variant="outline" className="bg-card text-foreground border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium py-0.5">
                🌶️ Flask (Python)
              </Badge>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Chaos testing & automated PR fixes are purpose-built for backend microservices and REST APIs. For frontend UI error tracking, use the <Link href="/sites" className="underline font-medium text-primary">PatchFlow SDK</Link>.
            </p>
          </div>

          <form onSubmit={handlePreview} className="flex flex-col gap-6">
            {error && (
              <div className="p-3.5 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
                {error}
              </div>
            )}

            {/* App Name */}
            <div className="flex flex-col gap-2">
              <label className="apple-subhead text-foreground font-semibold" htmlFor="app-name">
                App Name
              </label>
              <input
                id="app-name"
                type="text"
                required
                placeholder="e.g. billing-gateway"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 placeholder:text-muted-foreground text-foreground transition-all shadow-2xs"
              />
            </div>

            {/* App URL */}
            <div className="flex flex-col gap-2">
              <label className="apple-subhead text-foreground font-semibold" htmlFor="app-url">
                App URL
              </label>
              <input
                id="app-url"
                type="url"
                required
                placeholder="e.g. https://api.acme.com/v1"
                value={appUrl}
                onChange={(e) => setAppUrl(e.target.value)}
                className="w-full px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 placeholder:text-muted-foreground text-foreground transition-all shadow-2xs"
              />
            </div>

            {/* API Provision Tabs */}
            <div className="flex flex-col gap-2">
              <label className="apple-subhead text-foreground font-semibold">
                How to provide your API
              </label>
              <Tabs defaultValue="openapi" onValueChange={setApiType} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07] p-1 rounded-xl">
                  <TabsTrigger value="openapi" className="text-xs py-1.5 font-medium rounded-[8px]">OpenAPI URL</TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs py-1.5 font-medium rounded-[8px]">Upload file</TabsTrigger>
                  <TabsTrigger value="postman" className="text-xs py-1.5 font-medium rounded-[8px]">Postman</TabsTrigger>
                  <TabsTrigger value="manual" className="text-xs py-1.5 font-medium rounded-[8px]">Manual</TabsTrigger>
                </TabsList>

                <TabsContent value="openapi" className="mt-3">
                  <input
                    type="url"
                    placeholder="https://api.acme.com/openapi.json"
                    value={openapiUrl}
                    onChange={(e) => setOpenapiUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 placeholder:text-muted-foreground text-foreground transition-all shadow-2xs"
                  />
                </TabsContent>

                <TabsContent value="upload" className="mt-3">
                  {specFile ? (
                    <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-4 flex items-center justify-between bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">
                            {specFile.name}
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {(specFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSpecFile(null)}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 p-2 h-auto"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverSpec(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragOverSpec(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverSpec(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setSpecFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className={cn(
                        "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[140px]",
                        isDragOverSpec 
                          ? "border-primary bg-primary/5 scale-[0.985]" 
                          : "border-black/[0.1] dark:border-white/[0.1] bg-muted/30 hover:border-black/[0.15] dark:hover:border-white/[0.15]"
                      )}
                    >
                      <Upload className={cn("h-6 w-6 mb-2 transition-colors", isDragOverSpec ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-[12px] font-semibold text-foreground">
                        Drag & drop your OpenAPI JSON/YAML
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">or click to browse local files</span>
                      <input
                        type="file"
                        accept=".json,.yaml,.yml"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setSpecFile(e.target.files[0]);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="postman" className="mt-3">
                  {collectionFile ? (
                    <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-4 flex items-center justify-between bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">
                            {collectionFile.name}
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {(collectionFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCollectionFile(null)}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 p-2 h-auto"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverCollection(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragOverCollection(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverCollection(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setCollectionFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className={cn(
                        "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[140px]",
                        isDragOverCollection 
                          ? "border-primary bg-primary/5 scale-[0.985]" 
                          : "border-black/[0.1] dark:border-white/[0.1] bg-muted/30 hover:border-black/[0.15] dark:hover:border-white/[0.15]"
                      )}
                    >
                      <FileText className={cn("h-6 w-6 mb-2 transition-colors", isDragOverCollection ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-[12px] font-semibold text-foreground">
                        Upload Postman Collection JSON
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">v2.1 collection format supported</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setCollectionFile(e.target.files[0]);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="mt-3 flex flex-col gap-4">
                  <div className="flex gap-2">
                    <select
                      value={newMethod}
                      onChange={(e) => setNewMethod(e.target.value)}
                      className="px-3 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    >
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                    </select>
                    <input
                      type="text"
                      placeholder="e.g. /api/v1/users or /orders"
                      value={newPath}
                      onChange={(e) => setNewPath(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 placeholder:text-muted-foreground font-mono text-foreground transition-all shadow-2xs"
                    />
                    <Button type="button" onClick={addManualEndpoint} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter the backend API path to target. Automated PRs will patch the corresponding controller or route handler.
                  </p>

                  {/* Added Endpoints List */}
                  {manualEndpoints.length > 0 && (
                    <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-xl divide-y divide-black/[0.04] dark:divide-white/[0.05] max-h-48 overflow-y-auto bg-card">
                      {manualEndpoints.map((ep, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-bold px-1.5 py-0.5 rounded text-[10px]",
                              ep.method === "GET" ? "bg-blue-50 text-blue-700" :
                              ep.method === "POST" ? "bg-emerald-50 text-emerald-700" :
                              ep.method === "PUT" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                            )}>
                              {ep.method}
                            </span>
                            <span className="font-mono text-foreground">{ep.path}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeManualEndpoint(idx)}
                            className="text-muted-foreground hover:text-destructive transition-colors apple-press-icon"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* GitHub Repo Selector */}
            <div className="flex flex-col gap-2" ref={dropdownRef}>
              <label className="apple-subhead text-foreground font-semibold">
                GitHub Repo <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </label>

              <div className="relative">
                {reposLoading ? (
                  <div className="w-full flex items-center justify-between px-4 py-2.5 border border-black/[0.06] dark:border-white/[0.08] rounded-xl bg-muted/40 text-muted-foreground text-[13px]">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading repositories...
                    </span>
                  </div>
                ) : (
                  <div>
                    <div
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] rounded-xl text-[13px] cursor-pointer flex justify-between items-center hover:border-black/[0.12] dark:hover:border-white/[0.14] transition-colors bg-card select-none shadow-2xs"
                    >
                      <span className={cn(selectedRepo ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {selectedRepo ? selectedRepo.full_name : "Select a repository to push fixes to"}
                      </span>
                      {selectedRepo && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRepo(null);
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        >
                          Clear
                        </span>
                      )}
                    </div>

                    {dropdownOpen && (
                      <div className="absolute z-10 w-full mt-1.5 bg-card border border-black/[0.08] dark:border-white/[0.1] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.1)] max-h-60 overflow-hidden flex flex-col backdrop-blur-xl">
                        <div className="p-2 border-b border-black/[0.05] dark:border-white/[0.07] flex items-center gap-2 bg-muted/30">
                          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            type="text"
                            placeholder="Search repos..."
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none text-[12px] text-foreground"
                          />
                        </div>

                        <div className="overflow-y-auto max-h-48 divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                          {filteredRepos.length === 0 ? (
                            <div className="p-3 text-[12px] text-muted-foreground text-center">
                              No repositories found.
                            </div>
                          ) : (
                            filteredRepos.map((repo) => {
                              const isSelected = selectedRepo?.full_name === repo.full_name;
                              return (
                                <div
                                  key={repo.full_name}
                                  onClick={() => {
                                    setSelectedRepo(repo);
                                    setDropdownOpen(false);
                                    setRepoSearch("");
                                  }}
                                  className={cn(
                                    "p-3 text-[12px] cursor-pointer flex items-center justify-between hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors",
                                    isSelected && "bg-primary/5 text-primary font-semibold"
                                  )}
                                >
                                  <span>{repo.full_name}</span>
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Skip repository connection if you do not want automated Pull Requests.
              </span>
            </div>

            {/* Submit */}
            <div className="mt-4 pt-6 border-t border-black/[0.05] dark:border-white/[0.07] flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !appName || !appUrl}
                className="px-8 h-11 text-[14px] font-semibold flex items-center gap-2 bg-primary hover:bg-[#E04E16] text-white border-0 shadow-[0_2px_10px_rgba(255,90,31,0.3)] apple-press rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Parsing API spec...</span>
                  </>
                ) : (
                  <>
                    <span>Preview Endpoints</span>
                    <Play className="h-4 w-4 fill-current ml-1" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </>
      ) : (
        /* RENDER SELECT STEP */
        (() => {
          const totalEndpoints = previewData?.total_endpoints || 0;
          const groups = previewData?.groups || [];
          const selectedCount = selectedTempIds.size;

          const handleSelectAllRecommended = () => {
            const recommended = new Set<string>();
            let count = 0;
            for (const g of groups) {
              for (const ep of g.endpoints) {
                if (ep.recommended) {
                  if (count >= 10) {
                    setError("Selected recommended endpoints capped at 10.");
                    setSelectedTempIds(recommended);
                    return;
                  }
                  recommended.add(ep.temp_id);
                  count++;
                }
              }
            }
            setError(null);
            setSelectedTempIds(recommended);
          };

          const handleSelectAll = () => {
            const all = new Set<string>();
            let count = 0;
            for (const g of groups) {
              for (const ep of g.endpoints) {
                if (count >= 10) {
                  setError("Selection capped at the first 10 endpoints.");
                  setSelectedTempIds(all);
                  return;
                }
                all.add(ep.temp_id);
                count++;
              }
            }
            setError(null);
            setSelectedTempIds(all);
          };

          const handleDeselectAll = () => {
            setError(null);
            setSelectedTempIds(new Set());
          };

          const toggleTempId = (tempId: string) => {
            setSelectedTempIds((prev) => {
              const next = new Set(prev);
              if (next.has(tempId)) {
                next.delete(tempId);
                setError(null);
              } else {
                if (next.size >= 10) {
                  setError("A maximum of 10 endpoints can be selected.");
                  return prev;
                }
                setError(null);
                next.add(tempId);
              }
              return next;
            });
          };

          const toggleCollapsedTag = (tag: string) => {
            setCollapsedTags((prev) => {
              const next = new Set(prev);
              if (next.has(tag)) {
                next.delete(tag);
              } else {
                next.add(tag);
              }
              return next;
            });
          };

          return (
            <div className="w-full flex flex-col">
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-[13px] font-semibold text-text-secondary hover:text-foreground flex items-center gap-1.5 w-fit bg-transparent border-0 cursor-pointer apple-press-subtle"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Settings</span>
                </button>
              </div>

              <div className="mb-8">
                <h1 className="apple-title-2 text-foreground">Select Endpoints to Test</h1>
                <p className="apple-body text-text-secondary text-[13px] mt-1">
                  {totalEndpoints} endpoints found. Review and select what to chaos test.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3.5 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
                  {error}
                </div>
              )}

              {groups.length === 0 ? (
                <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-12 text-center bg-muted/30">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="apple-headline text-foreground">No endpoints found</h3>
                  <p className="text-[12px] text-text-secondary mt-1 mb-4">Go back and check your API source.</p>
                  <Button onClick={() => setStep("form")} variant="outline" size="sm">
                    Go Back
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-24">
                  {/* No-repo notice banner */}
                  {!selectedRepo && (
                    <div className="flex items-start gap-3 p-[12px_16px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl">
                      <Lightbulb className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">Running without a repository</span>
                        <span className="text-[12px] text-blue-600 dark:text-blue-400 leading-relaxed">
                          No GitHub repo was selected. PatchFlow will scan your endpoints and generate <strong>recommendations</strong> showing exactly what to fix and how — but no code will be committed and no pull requests will be opened. Connect a repo on the previous step to get automated PRs.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bulk Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] rounded-xl">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllRecommended}
                        className="px-3 py-1.5 text-[12px] font-semibold bg-card border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-text-secondary hover:text-foreground rounded-[8px] transition-all cursor-pointer apple-press-subtle"
                      >
                        Select All Recommended
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-3 py-1.5 text-[12px] font-semibold bg-card border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-text-secondary hover:text-foreground rounded-[8px] transition-all cursor-pointer apple-press-subtle"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-3 py-1.5 text-[12px] font-semibold bg-card border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-text-secondary hover:text-foreground rounded-[8px] transition-all cursor-pointer apple-press-subtle"
                      >
                        Deselect All
                      </button>
                    </div>
                    <span className="text-[12px] font-semibold text-text-secondary pr-1 select-none">
                      {selectedCount} of {totalEndpoints} selected
                    </span>
                  </div>

                  {/* Groups */}
                  <div className="flex flex-col gap-4">
                    {groups.map((group: any) => {
                      const tag = group.tag;
                      const endpoints = group.endpoints || [];
                      const isCollapsed = collapsedTags.has(tag);
                      
                      const groupSelectedCount = endpoints.filter((ep: any) => selectedTempIds.has(ep.temp_id)).length;
                      const groupTotalCount = endpoints.length;
                      const isEntireGroupHighRisk = endpoints.every((ep: any) => !ep.recommended);

                      return (
                        <div key={tag} className="border border-black/[0.06] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.02)] bg-card">
                          {/* Group Header */}
                          <div
                            onClick={() => toggleCollapsedTag(tag)}
                            className="px-4 py-3 bg-black/[0.015] dark:bg-white/[0.015] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between cursor-pointer select-none transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="apple-headline text-foreground">{tag}</span>
                            </div>
                            <span className="text-[12px] text-text-secondary font-medium select-none">
                              {groupSelectedCount} of {groupTotalCount} selected
                            </span>
                          </div>

                          {/* Group Content */}
                          {!isCollapsed && (
                            <div className="flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                              {isEntireGroupHighRisk && (
                                <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800 select-none">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span className="font-medium">This entire group is high-risk. Select with caution.</span>
                                </div>
                              )}

                              {endpoints.map((ep: any) => {
                                const isChecked = selectedTempIds.has(ep.temp_id);
                                const isHovered = hoveredTempId === ep.temp_id;
                                const isDangerous = !ep.recommended;

                                let methodClass = "";
                                switch (ep.method) {
                                  case "GET":
                                    methodClass = "bg-blue-50 text-blue-700 border border-blue-200/50";
                                    break;
                                  case "POST":
                                    methodClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                                    break;
                                  case "PUT":
                                    methodClass = "bg-amber-50 text-amber-700 border border-amber-200/50";
                                    break;
                                  case "PATCH":
                                    methodClass = "bg-purple-50 text-purple-700 border border-purple-200/50";
                                    break;
                                  case "DELETE":
                                    methodClass = "bg-red-50 text-red-700 border border-red-200/50";
                                    break;
                                  default:
                                    methodClass = "bg-muted text-foreground border border-black/[0.06]";
                                }

                                return (
                                  <div
                                    key={ep.temp_id}
                                    onMouseEnter={() => setHoveredTempId(ep.temp_id)}
                                    onMouseLeave={() => setHoveredTempId(null)}
                                    onClick={() => toggleTempId(ep.temp_id)}
                                    className={cn(
                                      "flex flex-col cursor-pointer transition-colors duration-150 select-none",
                                      isDangerous ? "bg-red-50/10 hover:bg-red-50/20 dark:bg-red-500/5 dark:hover:bg-red-500/10" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                                    )}
                                  >
                                    <div className="flex items-center gap-3 px-4 py-3 min-w-0">
                                      <div className="flex items-center justify-center shrink-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {}}
                                          className="h-4 w-4 accent-primary rounded border-black/[0.15] dark:border-white/[0.2] focus:ring-primary cursor-pointer"
                                        />
                                      </div>

                                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shrink-0", methodClass)}>
                                        {ep.method}
                                      </span>

                                      <span className="font-mono text-[13px] text-foreground font-medium truncate flex-1">
                                        {ep.path}
                                      </span>

                                      <span className="text-[12px] text-text-secondary truncate max-w-[200px] text-right hidden sm:inline">
                                        {ep.description}
                                      </span>
                                    </div>

                                    {isDangerous && ep.risk_note && (
                                      <div className="pl-12 pr-4 pb-2.5 flex items-start gap-1.5 text-xs text-amber-700">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{ep.risk_note}</span>
                                      </div>
                                    )}

                                    {isHovered && ep.sample_payload && (
                                      <div className="pl-12 pr-4 pb-3 border-t border-dashed border-zinc-150/50 bg-zinc-50/30">
                                        <div className="mt-2 text-[10px] font-mono text-zinc-650">
                                          <p className="font-semibold text-[9px] text-zinc-400 mb-1 select-none">SAMPLE PAYLOAD</p>
                                          <pre className="p-2.5 bg-slate-50 border border-zinc-200 rounded-lg overflow-x-auto max-h-40 max-w-full">
                                            {JSON.stringify(ep.sample_payload, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sticky Footer Bar */}
              <div className="fixed bottom-0 left-0 right-0 border-t border-black/[0.06] dark:border-white/[0.08] bg-card/95 backdrop-blur-xl saturate-[180%] py-4 px-6 z-20 flex justify-center shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="max-w-4xl w-full flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold rounded-xl text-[13px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer apple-press"
                  >
                    Back
                  </button>
                  
                  <span className="text-[12px] sm:text-[13px] font-semibold text-foreground select-none">
                    {selectedCount} endpoints selected {selectedCount >= 10 && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium ml-1">(max 10)</span>}
                  </span>

                  <button
                    type="button"
                    disabled={isSubmitting || selectedCount === 0}
                    onClick={handleStartSession}
                    className={cn(
                      "px-8 h-11 text-[14px] font-semibold rounded-xl text-white transition-all flex items-center gap-2",
                      selectedCount === 0 
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary hover:bg-[#E04E16] shadow-[0_2px_10px_rgba(255,90,31,0.3)] cursor-pointer apple-press"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Starting Run...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" />
                        <span>Run Chaos</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
