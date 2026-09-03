import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Users, Settings, Plus } from "lucide-react";

const tabs = [
  { to: "/", icon: LayoutDashboard, label: "Home", exact: true },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

/**
 * Persistent mobile bottom navigation with a centered "New invoice" pill.
 * Blink brand: full radius on the CTA, 8px radii on tabs, orange accent.
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="relative grid grid-cols-5 items-end px-1 pb-1 pt-1.5">
        {tabs.slice(0, 2).map((t) => (
          <TabLink key={t.to} {...t} active={isActive(t.to, (t as any).exact)} />
        ))}

        <div className="flex justify-center">
          <Link
            to="/invoices/new"
            aria-label="New invoice"
            className="-mt-6 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        {tabs.slice(2).map((t) => (
          <TabLink key={t.to} {...t} active={isActive(t.to, (t as any).exact)} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
