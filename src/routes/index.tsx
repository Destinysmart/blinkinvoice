import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowRight, FileText, Plus, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { fmtUsd, fmtDate, isOverdue } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const invoices = useAppStore((s) => s.invoices);
  const seedDemo = useAppStore((s) => s.seedDemo);
  useEffect(() => { seedDemo(); }, [seedDemo]);

  const stats = useMemo(() => {
    let total = 0, paidThisMonth = 0, outstanding = 0, overdue = 0;
    const now = new Date();
    for (const inv of invoices) {
      if (inv.currency !== "USD") continue;
      const { total: t } = invoiceTotal(inv);
      total += t;
      if (inv.status === "paid") {
        const d = new Date(inv.issueDate ?? inv.createdAt);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) paidThisMonth += t;
      } else if (inv.status === "pending") {
        outstanding += t;
        if (isOverdue(inv)) overdue += t;
      }
    }
    return { total, paidThisMonth, outstanding, overdue };
  }, [invoices]);

  const chartData = useMemo(() => {
    const months: { name: string; total: number; key: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        name: d.toLocaleDateString("en", { month: "short" }),
        total: 0,
      });
    }
    for (const inv of invoices) {
      if (inv.currency !== "USD" || inv.status !== "paid") continue;
      const d = new Date(inv.issueDate ?? inv.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.total += invoiceTotal(inv).total;
    }
    return months;
  }, [invoices]);

  const recent = invoices.slice(0, 5);

  const activity = useMemo(() => {
    return [...invoices]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6)
      .map((inv) => ({
        id: inv.id,
        dot: inv.status === "paid" ? "bg-success" : isOverdue(inv) ? "bg-destructive" : "bg-primary",
        text:
          inv.status === "paid"
            ? `Payment received from ${inv.client.name}`
            : `Invoice ${inv.number} created for ${inv.client.name}`,
        when: inv.createdAt,
      }));
  }, [invoices]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Here's how your business is doing.</p>
        </div>
        <Button asChild><Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total invoiced" value={fmtUsd(stats.total)} />
        <Kpi label="Paid this month" value={fmtUsd(stats.paidThisMonth)} tone="success" />
        <Kpi label="Outstanding" value={fmtUsd(stats.outstanding)} tone="primary" />
        <Kpi label="Overdue" value={fmtUsd(stats.overdue)} tone="destructive" pulse={stats.overdue > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent activity">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.text}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.when)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Revenue · last 6 months">
          <div className="h-56 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#6b6b6b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b6b" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  cursor={{ fill: "rgba(247,147,26,0.08)" }}
                  contentStyle={{ background: "#181818", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtUsd(v)}
                />
                <Bar dataKey="total" fill="#F7931A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Recent invoices"
        action={<Link to="/invoices" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
      >
        {recent.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 text-left font-medium">Invoice</th>
                <th className="py-2 text-left font-medium">Client</th>
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-left font-medium">Status</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => {
                const overdue = isOverdue(inv);
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="py-3">
                      <Link to="/invoices/$id" params={{ id: inv.id }} className="flex items-center gap-1.5 font-mono text-sm hover:text-primary">
                        {inv.paymentRequest && <Zap className="h-3 w-3 fill-primary text-primary" />}
                        {inv.number}
                      </Link>
                    </td>
                    <td className="py-3 text-sm">{inv.client.name}</td>
                    <td className="py-3 text-sm text-muted-foreground">{fmtDate(inv.issueDate ?? inv.createdAt)}</td>
                    <td className="py-3"><StatusBadge status={overdue ? "overdue" : inv.status} /></td>
                    <td className="py-3 text-right font-mono text-sm">{fmtUsd(invoiceTotal(inv).total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone, pulse }: { label: string; value: string; tone?: "success" | "primary" | "destructive"; pulse?: boolean }) {
  const color = tone === "success" ? "text-success" : tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
      </div>
      <p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
