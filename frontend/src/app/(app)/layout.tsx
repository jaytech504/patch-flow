"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity, LogOut, ChevronDown, LayoutDashboard,
  AlertTriangle, Globe, Play, Menu, X, CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { isTokenValid } from "@/lib/auth-fetch";
import { appleSprings } from "@/lib/springs";

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
        router.push("/login");
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
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9] dark:bg-[#0D0D0C]">
        <div className="h-8 w-8 rounded-full border-[3px] border-[#FF5A1F] border-r-transparent animate-spin" />
      </div>
    );
  }

  const username = user?.github_username || "User";
  const initials = username.substring(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#FAFAF9]/90 dark:bg-[#161615]/90 backdrop-blur-xl saturate-[180%]">
      {/* Brand logo header */}
      <div className="h-16 flex items-center px-5 border-b border-black/[0.05] dark:border-white/[0.07] shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 apple-press group">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white shadow-[0_2px_6px_rgba(255,90,31,0.3)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-[800] text-[#111110] dark:text-[#F5F5F4] tracking-tight">
            PatchFlow
          </span>
        </Link>
      </div>

      {/* Nav links with animated spring active indicator */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/sessions/new" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[13px] font-[500] transition-colors apple-press-subtle",
                active
                  ? "text-[#FF5A1F] font-[600]"
                  : "text-[#6F6B66] hover:text-[#111110] dark:text-[#9C9891] dark:hover:text-[#F5F5F4]"
              )}
            >
              {active && (
                <motion.div
                  layoutId="active-nav-indicator"
                  transition={appleSprings.default}
                  className="absolute inset-0 rounded-[10px] bg-[#FFEDE3] dark:bg-[#2E1B13]/80 border border-[#FF5A1F]/20"
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-[17px] w-[17px] shrink-0 transition-colors",
                  active ? "text-[#FF5A1F]" : "text-[#A3A099] dark:text-[#78756F]"
                )}
              />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile dropdown trigger */}
      <div className="px-3 py-3.5 border-t border-black/[0.05] dark:border-white/[0.07] shrink-0">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(p => !p)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer apple-press-subtle"
          >
            <Avatar className="h-7 w-7 border border-black/[0.08] dark:border-white/[0.1] shrink-0 shadow-sm">
              {user?.github_avatar_url && <AvatarImage src={user.github_avatar_url} alt={username} />}
              <AvatarFallback className="text-[10px] font-bold bg-[#F4F2EF] dark:bg-[#262623] text-[#111110] dark:text-[#F5F5F4]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-[13px] font-[600] text-[#111110] dark:text-[#F5F5F4] truncate flex-1 text-left">
              {username}
            </span>
            <ChevronDown
              className={cn(
                "h-[14px] w-[14px] text-[#A3A099] shrink-0 transition-transform duration-200",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 8 }}
                  transition={appleSprings.popover}
                  style={{ transformOrigin: "bottom left" }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white/95 dark:bg-[#1C1C1A]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1 z-50 overflow-hidden"
                >
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-[13px] font-medium text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[8px] transition-colors flex items-center gap-2 apple-press-subtle cursor-pointer"
                  >
                    <LogOut className="h-[14px] w-[14px]" />
                    Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9] dark:bg-[#0D0D0C]">
      {/* Desktop sidebar */}
      <aside className="w-[230px] hidden lg:block h-full border-r border-black/[0.05] dark:border-white/[0.07] shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer with interruptible spring gesture */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={appleSprings.default}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={appleSprings.sheet}
              className="fixed inset-y-0 left-0 z-50 w-[270px] shadow-2xl lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 bg-white/85 dark:bg-[#161615]/85 backdrop-blur-xl border-b border-black/[0.05] dark:border-white/[0.07] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-[8px] text-[#6F6B66] hover:bg-black/[0.04] transition-colors apple-press"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 apple-press">
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-[15px] font-[800] text-[#111110] dark:text-[#F5F5F4] tracking-tight">
              PatchFlow
            </span>
          </Link>
          <div className="w-8" />
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
