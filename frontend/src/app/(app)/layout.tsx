"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity, LogOut, ChevronDown, LayoutDashboard,
  AlertTriangle, Globe, Play, Menu, X, CreditCard
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { isTokenValid } from "@/lib/auth-fetch";

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/incidents",  label: "Incidents",  icon: AlertTriangle },
  { href: "/sites",      label: "Sites",      icon: Globe },
  { href: "/sessions/new", label: "New Scan", icon: Play },
  { href: "/settings/billing", label: "Billing & Plans", icon: CreditCard },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [authorized,    setAuthorized]    = useState(false);
  const [user,          setUser]          = useState<{ github_username: string; github_avatar_url: string | null } | null>(null);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);   // mobile drawer

  useEffect(() => {
    const token = localStorage.getItem("patchflow_token");
    if (!token) { router.push("/login"); return; }

    // Load cached user info immediately for fast render
    try {
      const stored = localStorage.getItem("patchflow_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    setAuthorized(true);

    // Then validate the token against the backend in the background
    isTokenValid().then((valid) => {
      if (!valid) {
        localStorage.removeItem("patchflow_token");
        localStorage.removeItem("patchflow_user");
        router.push("/login?expired=1");
      }
    });
  }, [router]);

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("patchflow_token");
    localStorage.removeItem("patchflow_user");
    router.push("/");
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
        <div className="h-8 w-8 rounded-full border-4 border-[#FF5A1F] border-r-transparent animate-spin" />
      </div>
    );
  }

  const username = user?.github_username || "User";
  const initials = username.substring(0, 2).toUpperCase();

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={cn(
        "flex flex-col bg-white border-r border-[#E7E5E2] h-full",
        mobile ? "w-[260px]" : "w-[220px] hidden lg:flex",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[#E7E5E2] shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-[#FF5A1F]" />
          <span className="text-[15px] font-[800] text-[#111110] tracking-tight">PatchFlow</span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/sessions/new" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-[500] transition-colors",
                active
                  ? "bg-[#FFF1EC] text-[#FF5A1F] font-[600]"
                  : "text-[#6F6B66] hover:text-[#111110] hover:bg-[#F3F2F0]",
              )}
            >
              <Icon className={cn("h-[16px] w-[16px] shrink-0", active ? "text-[#FF5A1F]" : "text-[#A3A099]")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-[#E7E5E2] shrink-0">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(p => !p)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] hover:bg-[#F3F2F0] transition-colors cursor-pointer"
          >
            <Avatar className="h-7 w-7 border border-[#E7E5E2] shrink-0">
              {user?.github_avatar_url && <AvatarImage src={user.github_avatar_url} alt={username} />}
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-[13px] font-[500] text-[#111110] truncate flex-1 text-left">{username}</span>
            <ChevronDown className="h-[14px] w-[14px] text-[#A3A099] shrink-0" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#E7E5E2] rounded-[10px] shadow-md py-1 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-[13px] text-[#6F6B66] hover:text-[#111110] hover:bg-[#F3F2F0] transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-[14px] w-[14px]" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile />
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 bg-white border-b border-[#E7E5E2] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-[6px] text-[#6F6B66] hover:bg-[#F3F2F0] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#FF5A1F]" />
            <span className="text-[14px] font-[800] text-[#111110]">PatchFlow</span>
          </Link>
          <div className="w-8" /> {/* spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
