import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Zap, MoreHorizontal, FileText, Download, Send } from "lucide-react";
import { useAppStore, invoiceTotal, genInvoiceNumber } from "@/lib/store";
import { fmtUsd, fmtDate, isOverdue } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { EmailStatusBadge } from "@/components/EmailStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { InfoHint } from "@/components/InfoHint";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoicesEmailStatus } from "@/lib/email.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/invoices/")({
  component: InvoicesPage,
});

type Filter = "all" | "draft" | "pending" | "paid" | "overdue";

function InvoicesPage() {
  const invoices = useAppStore((s) => s.invoices);
  const seedDemo = useAppStore((s) => s.seedDemo);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);

  const invoiceIds = useMemo(() => invoices.map((i) => i.id), [invoices]);
  const fetchEmailStatuses = useServerFn(getInvoicesEmailStatus);
  const { data: emailStatusData } = useQuery({
    queryKey: ["invoices_email_status", invoiceIds],
    queryFn: () => fetchEmailStatuses({ data: { invoiceIds } }),
    enabled: isAuthenticated && invoiceIds.length > 0,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
  const emailStatusByInvoice = emailStatusData?.byInvoice ?? {};

  const downloadPdf = async (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    try {
      const { downloadInvoicePDF } = await import("@/components/InvoicePDF");
      await downloadInvoicePDF(inv, settings);
      toast.success("PDF downloaded");
    }
    catch (e: any) { toast.error(e?.message ?? "Failed to generate PDF"); }
  };

  useEffect(() => { seedDemo(); }, [seedDemo]);

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const overdue = isOverdue(inv);
      if (filter === "overdue" && !overdue) return false;
      if (filter !== "all" && filter !== "overdue" && inv.status !== filter) return false;
      if (q && !(`${inv.number} ${inv.client.name} ${inv.client.email}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [invoices, filter, q]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const bulkDelete = () => {
    selected.forEach((id) => deleteInvoice(id));
    toast.success(`${selected.size} invoice${selected.size > 1 ? "s" : ""} deleted`);
    setSelected(new Set());
  };
  const bulkMarkSent = () => {
    selected.forEach((id) => updateInvoice(id, { status: "pending" }));
    toast.success("Marked as sent");
    setSelected(new Set());
  };

  const navigate = useNavigate();

  const sendAgain = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    const newId = crypto.randomUUID();
    const number = genInvoiceNumber(
      invoices.map((i) => i.number),
      settings.invoicePrefix || "INV",
    );
    addInvoice({
      ...inv,
      id: newId,
      number,
      status: "draft",
      issueDate: new Date().toISOString(),
      paymentRequest: null,
      paymentHash: null,
      satoshis: null,
      expiresAt: null,
      activity: [],
      createdAt: new Date().toISOString(),
    });
    toast.success("Invoice duplicated");
    navigate({ to: "/invoices/$id", params: { id: newId }, search: { send: 1 } as any });
  };

  // CSV export state
  const now = new Date();
  const [exportMode, setExportMode] = useState<"month" | "all" | "range">("month");
  const [exportMonth, setExportMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [exportFrom, setExportFrom] = useState<string>("");
  const [exportTo, setExportTo] = useState<string>("");
  const [exportOpen, setExportOpen] = useState(false);

  const doExport = () => {
    let from: Date | null = null;
    let to: Date | null = null;
    let filenameSuffix = "all";

    if (exportMode === "month") {
      const [y, m] = exportMonth.split("-").map(Number);
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 1);
      filenameSuffix = exportMonth;
    } else if (exportMode === "range") {
      if (!exportFrom || !exportTo) {
        toast.error("Pick a start and end date");
        return;
      }
      from = new Date(exportFrom);
      to = new Date(exportTo);
      to.setDate(to.getDate() + 1); // inclusive end
      filenameSuffix = `${exportFrom}-to-${exportTo}`;
    }

    const inRange = invoices.filter((inv) => {
      if (!from || !to) return true;
      const d = new Date(inv.issueDate ?? inv.createdAt);
      return d >= from && d < to;
    });

    if (inRange.length === 0) {
      toast.error("No invoices in that range");
      return;
    }

    const headers = [
      "Number", "Issue date", "Due date", "Client name", "Client email",
      "Currency", "Subtotal", "Tax %", "Total", "Status", "Memo", "Payment hash",
    ];
    const rows = inRange.map((inv) => {
      const { subtotal, total } = invoiceTotal(inv);
      const fmt = (n: number) =>
        inv.currency === "USD" ? n.toFixed(2) : String(Math.round(n));
      return [
        inv.number,
        inv.issueDate ? inv.issueDate.slice(0, 10) : inv.createdAt.slice(0, 10),
        inv.dueDate ? inv.dueDate.slice(0, 10) : "",
        inv.client.name,
        inv.client.email,
        inv.currency,
        fmt(subtotal),
        String(inv.tax ?? 0),
        fmt(total),
        isOverdue(inv) ? "overdue" : inv.status,
        inv.memo ?? "",
        inv.paymentHash ?? "",
      ];
    });

    downloadCsv(`invoices-${filenameSuffix}.csv`, toCsv(headers, rows));
    toast.success(`Exported ${inRange.length} invoice${inRange.length > 1 ? "s" : ""}`);
    setExportOpen(false);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "draft", label: "Draft" },
    { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }, { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, send, and track your invoices in one place."
        hint="Each invoice can be paid in USD or Bitcoin over the Lightning Network. Click any invoice to see details."
        actions={
          <div className="flex items-center gap-2">
            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Range</Label>
                  <div className="flex gap-1">
                    {(["month", "range", "all"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setExportMode(m)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition ${
                          exportMode === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        {m === "all" ? "All time" : m}
                      </button>
                    ))}
                  </div>
                </div>
                {exportMode === "month" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="export-month" className="text-xs">Month</Label>
                    <Input
                      id="export-month"
                      type="month"
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                    />
                  </div>
                )}
                {exportMode === "range" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="export-from" className="text-xs">From</Label>
                      <Input id="export-from" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="export-to" className="text-xs">To</Label>
                      <Input id="export-to" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                    </div>
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={doExport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download CSV
                </Button>
              </PopoverContent>
            </Popover>
            <Button asChild size="sm"><Link to="/invoices/new"><Plus className="mr-1.5 h-3.5 w-3.5" /> New invoice</Link></Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices…" className="h-8 pl-8 text-sm" />
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={bulkMarkSent}>Mark as sent</Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={bulkDelete}>Delete selected</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={invoices.length === 0 ? "No invoices yet" : "No matching invoices"}
          description={invoices.length === 0 ? "Create your first invoice and start getting paid." : "Try adjusting your filters."}
          action={invoices.length === 0 ? <Button asChild><Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link></Button> : null}
        />
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((inv) => {
              const overdue = isOverdue(inv);
              const { total } = invoiceTotal(inv);
              return (
                <li key={inv.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="min-w-0 flex-1">
                      <div className="font-mono text-sm text-primary truncate">{inv.number}</div>
                      <div className="mt-0.5 truncate text-sm font-medium">{inv.client.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Due <span className={overdue ? "text-destructive font-medium" : ""}>{fmtDate(inv.dueDate)}</span>
                      </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono text-sm font-semibold">
                        {inv.currency === "USD" ? fmtUsd(total) : `${Math.round(total).toLocaleString()} sats`}
                      </span>
                      <StatusBadge status={overdue ? "overdue" : inv.status} />
                      {emailStatusByInvoice[inv.id] && (
                        <EmailStatusBadge
                          status={emailStatusByInvoice[inv.id].delivery_status}
                          recipient={emailStatusByInvoice[inv.id].recipient_email}
                          error={emailStatusByInvoice[inv.id].delivery_error}
                          compact
                        />
                      )}
                      {inv.paymentRequest && <Zap className="h-3.5 w-3.5 fill-primary text-primary" />}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/invoices/$id" params={{ id: inv.id }}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateInvoice(inv.id, { status: "paid" })}>Mark as paid</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => sendAgain(inv.id)}><Send className="mr-2 h-3.5 w-3.5" /> Send again</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadPdf(inv.id)}>
                          <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { deleteInvoice(inv.id); toast.success("Deleted"); }}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-primary" />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">#</th>
                  <th className="px-3 py-3 text-left font-medium">Client</th>
                  <th className="px-3 py-3 text-left font-medium">Issue Date</th>
                  <th className="px-3 py-3 text-left font-medium">Due Date</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-center font-medium"><span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /><InfoHint text="Lightning column — a bolt icon means a Bitcoin Lightning invoice has been generated and the client can pay instantly." /></span></th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const overdue = isOverdue(inv);
                  const { total } = invoiceTotal(inv);
                  return (
                    <tr key={inv.id} className="group border-b border-border last:border-0 transition hover:bg-[var(--surface)] relative">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} className="accent-primary" />
                      </td>
                      <td className="px-3 py-3 relative">
                        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary opacity-0 group-hover:opacity-100 transition" />
                        <Link to="/invoices/$id" params={{ id: inv.id }} className="font-mono text-sm hover:text-primary">{inv.number}</Link>
                      </td>
                      <td className="px-3 py-3 text-sm">{inv.client.name}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{fmtDate(inv.issueDate ?? inv.createdAt)}</td>
                      <td className={`px-3 py-3 text-sm ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {inv.currency === "USD" ? fmtUsd(total) : `${Math.round(total).toLocaleString()} sats`}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={overdue ? "overdue" : inv.status} />
                          {emailStatusByInvoice[inv.id] && (
                            <EmailStatusBadge
                              status={emailStatusByInvoice[inv.id].delivery_status}
                              recipient={emailStatusByInvoice[inv.id].recipient_email}
                              error={emailStatusByInvoice[inv.id].delivery_error}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {inv.paymentRequest ? (
                          <Zap className="mx-auto h-4 w-4 fill-primary text-primary" />
                        ) : (
                          <span className="mx-auto block h-3.5 w-3.5 rounded-full border border-dashed border-muted-foreground/40" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/invoices/$id" params={{ id: inv.id }}>View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateInvoice(inv.id, { status: "paid" })}>Mark as paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendAgain(inv.id)}><Send className="mr-2 h-3.5 w-3.5" /> Send again</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadPdf(inv.id)}>
                              <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { deleteInvoice(inv.id); toast.success("Deleted"); }}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>

      )}
    </div>
  );
}
