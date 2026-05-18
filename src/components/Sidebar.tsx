import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Zap, LayoutDashboard, FileText, Users,
  Package, FolderKanban, BarChart3, Settings, LogOut, Plus,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuth, signOut } from "@/lib/auth";
import { toast } from "sonner";
import { HintWrap } from "./InfoHint";

const groups = [
  {
    label: "Workspace",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true, hint: "Overview of revenue, outstanding invoices, and recent activity." },
      { to: "/invoices", icon: FileText, label: "Invoices", hint: "Create, send, and track invoices. Get paid in Bitcoin over Lightning." },
      { to: "/clients", icon: Users, label: "Clients", hint: "Saved customers — reuse their details when creating invoices." },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/expenses", icon: Package, label: "Expenses", hint: "Log business expenses to track profit and prep for taxes." },
      { to: "/projects", icon: FolderKanban, label: "Projects", hint: "Group invoices and expenses by project." },
      { to: "/reports", icon: BarChart3, label: "Reports", hint: "Revenue, profit and tax summaries you can export." },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/settings", icon: Settings, label: "Settings", hint: "Business info, Lightning wallet connection, email and tax defaults." }],
  },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const connected = Boolean(apiKey);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-[240px] shrink-0 flex-col border-r border-border bg-[#0B0B0B]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_0_18px_-6px_var(--primary)]">
            <Zap className="h-4 w-4 fill-current" />
          </span>
          <div>
            <div className="font-display text-[15px] font-semibold leading-none tracking-tight">BlinkPay</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Bitcoin Invoicing</div>
          </div>
        </Link>
      </div>

      {/* Quick action */}
      <div className="px-3 pb-4">
        <Link
          to="/invoices/new"
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> New invoice
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.to, (it as any).exact);
                return (
                  <li key={it.to}>
                    <HintWrap hint={(it as any).hint} side="right">
                      <Link
                        to={it.to}
                        className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />}
                        <it.icon className="h-[15px] w-[15px]" />
                        <span>{it.label}</span>
                      </Link>
                    </HintWrap>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="border-t border-border p-3 space-y-2">
        <HintWrap hint={connected ? "Your Lightning wallet is connected. You can generate Lightning invoices." : "Connect a Lightning wallet in Settings to accept Bitcoin payments."} side="top">
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 cursor-default">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
              <span className="text-[11px] text-muted-foreground">Wallet</span>
            </div>
            <span className="text-[11px] font-medium">{connected ? "Connected" : "Not connected"}</span>
          </div>
        </HintWrap>

        {user && (
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] text-muted-foreground" title={user.email ?? ""}>
                {user.email}
              </div>
            </div>
            <HintWrap hint="Sign out of BlinkPay" side="top">
              <button
                onClick={handleSignOut}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </HintWrap>
          </div>
        )}
      </div>
    </aside>
  );
}

// Mobile top bar (sidebar collapses on small screens)
export function MobileBar() {
  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-[#0B0B0B] px-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">
          <Zap className="h-3.5 w-3.5 fill-current" />
        </span>
        <span className="font-display text-base font-semibold">BlinkPay</span>
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
