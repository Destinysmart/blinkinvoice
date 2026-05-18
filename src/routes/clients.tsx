import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Users } from "lucide-react";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { fmtUsd, fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const invoices = useAppStore((s) => s.invoices);
  const seedDemo = useAppStore((s) => s.seedDemo);
  useEffect(() => { seedDemo(); }, [seedDemo]);

  const clients = useMemo(() => {
    const map = new Map<string, { name: string; email: string; address: string; total: number; outstanding: number; count: number; last: string }>();
    for (const inv of invoices) {
      const key = inv.client.name;
      const t = invoiceTotal(inv).total;
      const usd = inv.currency === "USD" ? t : 0;
      const cur = map.get(key) ?? { ...inv.client, total: 0, outstanding: 0, count: 0, last: inv.createdAt };
      cur.total += usd;
      if (inv.status === "pending") cur.outstanding += usd;
      cur.count += 1;
      if (new Date(inv.createdAt) > new Date(cur.last)) cur.last = inv.createdAt;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everyone you've billed.</p>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet"
          description="Clients appear here once you create invoices for them." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 text-right font-medium">Invoices</th>
                <th className="px-4 py-3 text-left font-medium">Last invoice</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.name} className="border-b border-border last:border-0 hover:bg-[var(--surface)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                        {initials(c.name)}
                      </span>
                      <Link to="/invoices" className="text-sm font-medium hover:text-primary">{c.name}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{fmtUsd(c.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-primary">{c.outstanding ? fmtUsd(c.outstanding) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{c.count}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{fmtDate(c.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
