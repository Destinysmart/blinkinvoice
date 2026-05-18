import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Zap, LayoutDashboard, FileText, MessageSquareQuote, Users,
  Package, FolderKanban, BarChart3, Settings, LogOut,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuth, signOut } from "@/lib/auth";
import { toast } from "sonner";

const groups = [
  {
    label: "Business",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
      { to: "/invoices", icon: FileText, label: "Invoices" },
      { to: "/quotes", icon: MessageSquareQuote, label: "Quotes" },
      { to: "/clients", icon: Users, label: "Clients" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/expenses", icon: Package, label: "Expenses" },
      { to: "/projects", icon: FolderKanban, label: "Projects" },
      { to: "/reports", icon: BarChart3, label: "Reports" },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/settings", icon: Settings, label: "Settings" }],
  },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const connected = Boolean(apiKey);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-[260px] shrink-0 flex-col border-r border-border bg-[#0D0D0D]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]">
            <Zap className="h-5 w-5 fill-current" />
          </span>
          <div>
            <div className="font-display text-lg font-bold leading-none tracking-tight">BlinkPay</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Bitcoin Invoicing</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-6">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.to, (it as any).exact);
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
                      <it.icon className="h-4 w-4" />
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">BTC</span>
          <span className="font-mono text-xs font-bold text-primary">$68,420</span>
        </div>
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-muted-foreground">Wallet</span>
          <span className="font-mono text-foreground">— sats</span>
        </div>
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-muted-foreground">{connected ? "Connected" : "Not connected"}</span>
        </div>
      </div>
    </aside>
  );
}

// Mobile top bar (sidebar collapses on small screens)
export function MobileBar() {
  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-[#0D0D0D] px-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">
          <Zap className="h-3.5 w-3.5 fill-current" />
        </span>
        <span className="font-display text-base font-bold">BlinkPay</span>
      </Link>
      <nav className="flex items-center gap-1 text-xs">
        {[
          { to: "/", label: "Home" },
          { to: "/invoices", label: "Invoices" },
          { to: "/clients", label: "Clients" },
          { to: "/settings", label: "Settings" },
        ].map((t) => (
          <Link key={t.to} to={t.to} className="rounded px-2 py-1 text-muted-foreground hover:text-foreground">
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
