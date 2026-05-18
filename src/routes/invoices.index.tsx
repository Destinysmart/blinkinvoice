import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Plus, Zap } from "lucide-react";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invoices/")({
  component: InvoicesPage,
});

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function InvoicesPage() {
  const invoices = useAppStore((s) => s.invoices);
  const seedDemo = useAppStore((s) => s.seedDemo);

  useEffect(() => { seedDemo(); }, [seedDemo]);

  const stats = useMemo(() => {
    let total = 0, received = 0, outstanding = 0;
    for (const inv of invoices) {
      const { total: t } = invoiceTotal(inv);
      const usd = inv.currency === "USD" ? t : 0;
      total += usd;
      if (inv.status === "paid") received += usd;
      else if (inv.status === "pending") outstanding += usd;
    }
    return { total, received, outstanding };
  }, [invoices]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bill clients. Get paid in Bitcoin.</p>
        </div>
        <Button asChild>
          <Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total invoiced" value={fmtUsd(stats.total)} />
        <StatCard label="Received" value={fmtUsd(stats.received)} accent="success" />
        <StatCard label="Outstanding" value={fmtUsd(stats.outstanding)} accent="primary" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Invoice</th>
              <th className="px-4 py-3 text-left font-medium">Client</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>
            )}
            {invoices.map((inv) => {
              const { total } = invoiceTotal(inv);
              return (
                <tr key={inv.id} className="border-b border-border last:border-0 transition hover:bg-[var(--surface)]">
                  <td className="px-4 py-4">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="flex items-center gap-2 font-mono text-sm text-foreground hover:text-primary">
                      {inv.paymentRequest && <Zap className="h-3.5 w-3.5 fill-primary text-primary" />}
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm">{inv.client.name}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-4 text-right font-mono text-sm">
                    {inv.currency === "USD" ? fmtUsd(total) : `${total.toLocaleString()} sats`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "success" | "primary" }) {
  const color = accent === "success" ? "text-success" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
