import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/blinkinvoice-logo.png";

const tabs = [
  { to: "/invoices", label: "Invoices" },
  { to: "/invoices/new", label: "New" },
  { to: "/settings", label: "Settings" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/invoices" className="flex items-center gap-2">
          <img src={logoUrl} alt="BlinkInvoice" className="h-10 w-10 object-contain" />
          <span className="font-display text-xl font-bold tracking-tight">BlinkInvoice</span>
        </Link>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.to === "/invoices/new" || t.to === "/settings" }}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
