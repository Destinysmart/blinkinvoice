import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Building2, Mail, MapPin, TrendingUp, FilePlus2, Pencil, FileText, CreditCard, History,
} from "lucide-react";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/clients/$name")({
  component: ClientDetailPage,
  head: ({ params }) => {
    const name = decodeURIComponent(params.name);
    return {
      meta: [
        { title: `${name} · Client · BlinkInvoice` },
        { name: "description", content: `Invoices, payments, and activity for ${name}.` },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Failed to load client: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Client not found.</div>,
});

type Tab = "invoices" | "payments" | "history";

function ClientDetailPage() {
  const { name: rawName } = Route.useParams();
  const name = decodeURIComponent(rawName);
  const navigate = useNavigate();

  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);

  const [tab, setTab] = useState<Tab>("invoices");

  const saved = clients.find((c) => c.name === name);
  const clientInvoices = useMemo(
    () => invoices.filter((i) => i.client.name === name)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invoices, name],
  );

  const contact = {
    email: saved?.email || clientInvoices[0]?.client.email || "",
    address: saved?.address || clientInvoices[0]?.client.address || "",
  };

  // Per-currency standing
  const standing = useMemo(() => {
    const acc: Record<"USD" | "BTC", { invoiced: number; paid: number; outstanding: number; count: number }> = {
      USD: { invoiced: 0, paid: 0, outstanding: 0, count: 0 },
      BTC: { invoiced: 0, paid: 0, outstanding: 0, count: 0 },
    };
    for (const inv of clientInvoices) {
      const t = invoiceTotal(inv).total;
      const b = acc[inv.currency];
      b.count += 1;
      if (inv.status === "draft") continue;
      b.invoiced += t;
      if (inv.status === "paid") b.paid += t;
      else if (inv.status === "pending") b.outstanding += t;
    }
    return acc;
  }, [clientInvoices]);

  const paidInvoices = clientInvoices.filter((i) => i.status === "paid");

  const history = useMemo(() => {
    const rows: { at: string; text: string; invoiceId: string; number: string }[] = [];
    for (const inv of clientInvoices) {
      for (const a of inv.activity ?? []) {
        rows.push({ at: a.at, text: a.text, invoiceId: inv.id, number: inv.number });
      }
      rows.push({
        at: inv.createdAt,
        text: `Invoice ${inv.number} created`,
        invoiceId: inv.id,
        number: inv.number,
      });
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [clientInvoices]);

  const startNewInvoice = () => {
    navigate({
      to: "/invoices/new",
      search: { name, email: contact.email, address: contact.address },
    });
  };

  const currenciesInUse = (["USD", "BTC"] as const).filter((c) => standing[c].count > 0);

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-2">
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All clients
        </Link>
        <div className="flex items-center gap-2">
          {saved && (
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/clients", search: { edit: saved.id } as any })}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          <Button size="sm" onClick={startNewInvoice}>
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> New invoice
          </Button>
        </div>
      </div>

      {/* Title */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-3xl">{name}</h1>
            <p className="text-xs text-muted-foreground">
              {saved ? `Client since ${fmtDate(saved.createdAt)}` : "Referenced only by invoices"}
            </p>
          </div>
        </div>
      </header>

      {/* 4-card header */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard icon={Building2} title="Details">
          <Row label="Name" value={name} />
          <Row label="Type" value={saved ? "Saved client" : "From invoice"} />
          <Row label="Since" value={saved ? fmtDate(saved.createdAt) : "—"} />
        </InfoCard>

        <InfoCard icon={MapPin} title="Address">
          {contact.address ? (
            <p className="whitespace-pre-line text-sm">{contact.address}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No address on file</p>
          )}
        </InfoCard>

        <InfoCard icon={Mail} title="Contact">
          <Row label="Email" value={contact.email || "—"} mono />
        </InfoCard>

        <InfoCard icon={TrendingUp} title="Standing">
          {currenciesInUse.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {currenciesInUse.map((c) => (
                <div key={c} className="space-y-0.5">
                  {currenciesInUse.length > 1 && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c}</div>
                  )}
                  <Row label="Paid" value={fmtMoney(standing[c].paid, c)} mono />
                  <Row label="Outstanding" value={fmtMoney(standing[c].outstanding, c)} mono strong={standing[c].outstanding > 0} />
                </div>
              ))}
            </div>
          )}
        </InfoCard>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")} icon={FileText}>
            Invoices <span className="ml-1 text-muted-foreground">({clientInvoices.length})</span>
          </TabButton>
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")} icon={CreditCard}>
            Payments <span className="ml-1 text-muted-foreground">({paidInvoices.length})</span>
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={History}>
            History <span className="ml-1 text-muted-foreground">({history.length})</span>
          </TabButton>
        </nav>
      </div>

      {tab === "invoices" && (
        <InvoiceList invoices={clientInvoices} onNew={startNewInvoice} />
      )}
      {tab === "payments" && (
        <InvoiceList invoices={paidInvoices} emptyText="No payments received yet." />
      )}
      {tab === "history" && (
        <HistoryList rows={history} />
      )}
    </div>
  );
}

function InvoiceList({
  invoices, onNew, emptyText,
}: {
  invoices: ReturnType<typeof useAppStore.getState>["invoices"];
  onNew?: () => void;
  emptyText?: string;
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        {emptyText ?? "No invoices for this client yet."}
        {onNew && (
          <div className="mt-3">
            <Button size="sm" onClick={onNew}>
              <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> New invoice
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Number</th>
            <th className="px-4 py-2.5 text-left font-medium">Date</th>
            <th className="px-4 py-2.5 text-left font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const t = invoiceTotal(inv).total;
            return (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-[var(--surface)]">
                <td className="px-4 py-2.5">
                  <Link to="/invoices/$id" params={{ id: inv.id }} className="font-mono text-xs font-medium hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(inv.issueDate ?? inv.createdAt)}</td>
                <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(t, inv.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryList({ rows }: { rows: { at: string; text: string; invoiceId: string; number: string }[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
          <div className="min-w-0 flex-1">
            <div className="text-sm">{r.text}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{fmtDate(r.at)}</span>
              <span>·</span>
              <Link to="/invoices/$id" params={{ id: r.invoiceId }} className="font-mono hover:underline">
                {r.number}
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function InfoCard({
  icon: Icon, title, children,
}: {
  icon: typeof Building2; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right ${mono ? "font-mono text-xs" : ""} ${strong ? "font-semibold text-primary" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, children,
}: {
  active: boolean; onClick: () => void; icon: typeof FileText; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
