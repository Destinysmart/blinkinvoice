import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Users,
  Package, FolderKanban, BarChart3, Settings, LogOut, Boxes, Sun, Moon,
} from "lucide-react";
import logoUrl from "@/assets/blinkinvoice-logo.png";
import { useAppStore } from "@/lib/store";
import { useWalletConnect } from "lightningconnect";
import { useAuth, signOut } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { HintWrap } from "./InfoHint";

const baseGroups = [
  {
    label: "Workspace",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true, hint: "Overview of revenue, outstanding invoices, and recent activity." },
      { to: "/invoices", icon: FileText, label: "Invoices", hint: "Create, send, and track invoices. Get paid in Bitcoin over Lightning." },
      { to: "/products", icon: Boxes, label: "Products", hint: "Reusable products and services that auto-fill into invoice line items." },
      { to: "/clients", icon: Users, label: "Clients", hint: "Saved customers — reuse their details when creating invoices." },
    ],
  },
] as const;

const advancedGroup = {
  label: "Finance",
  items: [
    { to: "/expenses", icon: Package, label: "Expenses", hint: "Log business expenses to track profit and prep for taxes." },
    { to: "/projects", icon: FolderKanban, label: "Projects", hint: "Group invoices and expenses by project." },
    { to: "/reports", icon: BarChart3, label: "Reports", hint: "Revenue, profit and tax summaries you can export." },
  ],
} as const;

const accountGroup = {
  label: "Account",
  items: [{ to: "/settings", icon: Settings, label: "Settings", hint: "Business info, Lightning wallet connection, email and tax defaults." }],
} as const;

function useNavGroups() {
  const showAdvanced = useAppStore((s) => s.settings.showAdvanced);
  return showAdvanced
    ? [...baseGroups, advancedGroup, accountGroup]
    : [...baseGroups, accountGroup];
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isConnected: connected } = useWalletConnect();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const guest = useAppStore((s) => s.guest);
  const exitGuest = useAppStore((s) => s.exitGuest);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  const groups = useNavGroups();
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-[240px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="px-5 pt-5 pb-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoUrl} alt="BlinkInvoice" className="h-14 w-14 object-contain" />
          <div>
            <div className="font-display text-[15px] font-semibold leading-none tracking-tight">BlinkInvoice</div>
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
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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

        {!user && guest && (
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <Link to="/signup" className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary hover:underline">
              Guest — create account
            </Link>
            <HintWrap hint={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} side="top">
              <button
                onClick={toggleTheme}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </HintWrap>
            <HintWrap hint="Exit guest mode — clears invoices stored on this device" side="top">
              <button
                onClick={() => {
                  exitGuest();
                  toast.success("Guest session cleared");
                  navigate({ to: "/login" });
                }}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                aria-label="Exit guest mode"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </HintWrap>
          </div>
        )}

        {user && (
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] text-muted-foreground" title={user.email ?? ""}>
                {user.email}
              </div>
            </div>
            <HintWrap hint={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} side="top">
              <button
                onClick={toggleTheme}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </HintWrap>
            <HintWrap hint="Sign out of BlinkInvoice" side="top">
              <button
                onClick={handleSignOut}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
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

// Mobile top bar: brand + theme toggle. Navigation lives in MobileTabBar.
export function MobileBar() {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <Link to="/" className="flex items-center gap-2">
        <img src={logoUrl} alt="BlinkInvoice" className="h-8 w-8 object-contain" />
        <span className="font-display text-base font-semibold">BlinkInvoice</span>
      </Link>

      <HintWrap hint={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} side="bottom">
        <button
          onClick={toggleTheme}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition active:scale-95"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </HintWrap>
    </header>
  );
}
