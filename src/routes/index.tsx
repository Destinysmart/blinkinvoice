import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  ArrowRight, ArrowUpRight, FileText, Plus, Zap, CheckCircle2, Circle,
  Wallet, Building2, Users, TrendingUp, Clock, AlertTriangle, DollarSign,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { fmtUsd, fmtSats, fmtDate, isOverdue } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { InfoHint } from "@/components/InfoHint";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const settings = useAppStore((s) => s.settings);
  const seedDemo = useAppStore((s) => s.seedDemo);
  const { user } = useAuth();
  useEffect(() => { seedDemo(); }, [seedDemo]);

  const stats = useMemo(() => {
    const empty = () => ({ usd: 0, btc: 0 });
    const total = empty();
    const paidThisMonth = empty();
    const paidLastMonth = empty();
    const outstanding = empty();
    const overdue = empty();
    const now = new Date();
    const thisM = now.getMonth(), thisY = now.getFullYear();
    const lastDate = new Date(thisY, thisM - 1, 1);
    for (const inv of invoices) {
      const { total: t } = invoiceTotal(inv);
      const bucket = inv.currency === "BTC" ? "btc" : "usd";
      total[bucket] += t;
      if (inv.status === "paid") {
        const d = new Date(inv.issueDate ?? inv.createdAt);
        if (d.getMonth() === thisM && d.getFullYear() === thisY) paidThisMonth[bucket] += t;
        if (d.getMonth() === lastDate.getMonth() && d.getFullYear() === lastDate.getFullYear()) paidLastMonth[bucket] += t;
      } else if (inv.status === "pending") {
        outstanding[bucket] += t;
        if (isOverdue(inv)) overdue[bucket] += t;
      }
    }
    const usdLast = paidLastMonth.usd;
    const trend = usdLast === 0 ? null : ((paidThisMonth.usd - usdLast) / usdLast) * 100;
    return { total, paidThisMonth, outstanding, overdue, trend };
  }, [invoices]);

  // Format a {usd, btc} bucket. Shows both when both non-zero; otherwise the
  // non-zero one; falls back to $0.00 when both are zero.
  const fmtBucket = (b: { usd: number; btc: number }) => {
    const parts: string[] = [];
    if (b.usd > 0) parts.push(fmtUsd(b.usd));
    if (b.btc > 0) parts.push(fmtSats(b.btc));
    return parts.length ? parts.join(" · ") : fmtUsd(0);
  };

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

  // Onboarding checklist
  const setup = [
    {
      done: Boolean(settings.businessName),
      label: "Add your business details",
      desc: "Name, email and address shown on invoices.",
      to: "/settings",
      icon: Building2,
    },
    {
      done: Boolean(settings.apiKey),
      label: "Connect your Lightning wallet",
      desc: "Required to accept Bitcoin payments.",
      to: "/settings",
      icon: Wallet,
    },
    {
      done: clients.length > 0,
      label: "Add your first client",
      desc: "Save customers so you can reuse them on invoices.",
      to: "/clients",
      icon: Users,
    },
    {
      done: invoices.length > 0,
      label: "Send your first invoice",
      desc: "Bill a client and start getting paid.",
      to: "/invoices/new",
      icon: FileText,
    },
  ];
  const doneCount = setup.filter((s) => s.done).length;
  const allDone = doneCount === setup.length;

  const displayName =
    settings.businessName?.trim() ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${displayName}`}
        subtitle="Here's a snapshot of your business today."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/invoices"><FileText className="mr-1.5 h-3.5 w-3.5" /> All invoices</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/invoices/new"><Plus className="mr-1.5 h-3.5 w-3.5" /> New invoice</Link>
            </Button>
          </>
        }
      />

      {/* Onboarding checklist */}
      {!allDone && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-[var(--surface)] px-5 py-3">
            <div>
              <div className="text-sm font-semibold">Get set up</div>
              <div className="text-xs text-muted-foreground">
                {doneCount} of {setup.length} complete — finish setup to start accepting Bitcoin payments.
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{Math.round((doneCount / setup.length) * 100)}%</span>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {setup.map((s) => (
              <li key={s.label}>
                <Link
                  to={s.to}
                  className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.02]"
                >
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>
                      {s.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </div>
                  {!s.done && (
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={DollarSign}
          label="Total invoiced"
          value={fmtBucket(stats.total)}
          hint="All invoice amounts across every status. USD and Bitcoin shown separately."
        />
        <Kpi
          icon={TrendingUp}
          label="Paid this month"
          value={fmtBucket(stats.paidThisMonth)}
          tone="success"
          trend={stats.trend}
          hint="Invoices marked as paid in the current calendar month. Trend compares USD vs last month."
        />
        <Kpi
          icon={Clock}
          label="Outstanding"
          value={fmtBucket(stats.outstanding)}
          tone="primary"
          hint="Invoices that have been sent but not yet paid."
        />
        <Kpi
          icon={AlertTriangle}
          label="Overdue"
          value={fmtBucket(stats.overdue)}
          tone="destructive"
          pulse={stats.overdue.usd + stats.overdue.btc > 0}
          hint="Sent invoices past their due date. Tap an invoice to send a reminder."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title="Revenue"
          subtitle="Last 6 months · paid invoices"
          className="lg:col-span-2"
          hint="Sum of paid USD invoices per month, based on the invoice issue date."
        >
          <div className="h-60 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#6b6b6b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b6b" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  cursor={{ fill: "rgba(232,93,58,0.08)" }}
                  contentStyle={{ background: "#181818", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtUsd(v)}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Recent activity" hint="Newest invoices and payments across your account.">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(a.when)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
            <Button asChild size="sm" className="mt-4">
              <Link to="/invoices/new"><Plus className="mr-1.5 h-3.5 w-3.5" /> Create your first invoice</Link>
            </Button>
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
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
                      <Link to="/invoices/$id" params={{ id: inv.id }} className="flex items-center gap-1.5 font-mono text-[13px] hover:text-primary">
                        {inv.paymentRequest && <Zap className="h-3 w-3 fill-primary text-primary" />}
                        {inv.number}
                      </Link>
                    </td>
                    <td className="py-3 text-[13px]">{inv.client.name}</td>
                    <td className="py-3 text-[13px] text-muted-foreground">{fmtDate(inv.issueDate ?? inv.createdAt)}</td>
                    <td className="py-3"><StatusBadge status={overdue ? "overdue" : inv.status} /></td>
                    <td className="py-3 text-right font-mono text-[13px]">{fmtUsd(invoiceTotal(inv).total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  label, value, tone, pulse, hint, icon: Icon, trend,
}: {
  label: string;
  value: string;
  tone?: "success" | "primary" | "destructive";
  pulse?: boolean;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: number | null;
}) {
  const color =
    tone === "success" ? "text-success"
    : tone === "primary" ? "text-primary"
    : tone === "destructive" ? "text-destructive"
    : "text-foreground";
  const iconBg =
    tone === "success" ? "bg-success/10 text-success"
    : tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "destructive" ? "bg-destructive/10 text-destructive"
    : "bg-white/[0.05] text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition hover:border-border/80">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {Icon && <span className={`grid h-7 w-7 place-items-center rounded-md ${iconBg}`}><Icon className="h-3.5 w-3.5" /></span>}
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {pulse && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
          {hint && <InfoHint text={hint} />}
        </div>
      </div>
      <p className={`mt-3 font-mono text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
      {trend !== undefined && trend !== null && (
        <p className={`mt-1 text-[11px] font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(0)}% vs last month
        </p>
      )}
    </div>
  );
}

function Card({
  title, subtitle, children, action, hint, className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-border bg-card p-4 md:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            {hint && <InfoHint text={hint} />}
          </div>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
