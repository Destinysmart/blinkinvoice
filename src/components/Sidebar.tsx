import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Zap, LayoutDashboard, FileText, Users,
  Package, FolderKanban, BarChart3, Settings, LogOut, Plus, Menu, Boxes, Sun, Moon,
} from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth, signOut } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { HintWrap } from "./InfoHint";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const groups = [
  {
    label: "Workspace",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true, hint: "Overview of revenue, outstanding invoices, and recent activity." },
      { to: "/invoices", icon: FileText, label: "Invoices", hint: "Create, send, and track invoices. Get paid in Bitcoin over Lightning." },
      { to: "/products", icon: Boxes, label: "Products", hint: "Reusable products and services that auto-fill into invoice line items." },
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
  const { theme, toggle: toggleTheme } = useTheme();

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
            <div className="font-display text-[15px] font-semibold leading-none tracking-tight">BlinkInvoice</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Bitcoin Invoicing</div>
          </div>
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
            <HintWrap hint="Sign out of BlinkInvoice" side="top">
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

// Mobile top bar: hamburger -> full sidebar drawer + quick new invoice CTA.
export function MobileBar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    setOpen(false);
    navigate({ to: "/login" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-[#0B0B0B] px-4">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-foreground transition active:scale-95"
            >
              <Menu className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] border-r border-border bg-[#0B0B0B] p-0">
            <div className="flex h-full flex-col">
              <div className="px-5 pt-6 pb-5">
                <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Zap className="h-4 w-4 fill-current" />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold leading-none tracking-tight">BlinkInvoice</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Bitcoin Invoicing</div>
                  </div>
                </Link>
              </div>


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
                            <Link
                              to={it.to}
                              onClick={() => setOpen(false)}
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                              }`}
                            >
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

              {user && (
                <div className="border-t border-border p-4">
                  <div className="mb-2 truncate text-xs text-muted-foreground">{user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">
            <Zap className="h-3.5 w-3.5 fill-current" />
          </span>
          <span className="font-display text-base font-semibold">BlinkInvoice</span>
        </Link>
      </div>

    </header>
  );
}
