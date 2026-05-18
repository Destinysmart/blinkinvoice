import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Zap, MoreHorizontal, FileText, Download } from "lucide-react";
import { downloadInvoicePDF } from "@/components/InvoicePDF";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { fmtUsd, fmtDate, isOverdue } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
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

  const downloadPdf = async (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    try { await downloadInvoicePDF(inv, settings); toast.success("PDF downloaded"); }
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

  const duplicate = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    addInvoice({ ...inv, id: crypto.randomUUID(), number: `${inv.number}-COPY`, status: "draft", createdAt: new Date().toISOString(), paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null });
    toast.success("Invoice duplicated");
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "draft", label: "Draft" },
    { key: "pending", label: "Pending" }, { key: "paid", label: "Paid" }, { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bill clients. Get paid in Bitcoin.</p>
        </div>
        <Button asChild><Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link></Button>
      </div>

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
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
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
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full">
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
                <th className="px-3 py-3 text-center font-medium"><Zap className="inline h-3.5 w-3.5" /></th>
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
                    <td className="px-3 py-3"><StatusBadge status={overdue ? "overdue" : inv.status} /></td>
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
                          <button className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/invoices/$id" params={{ id: inv.id }}>View</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateInvoice(inv.id, { status: "paid" })}>Mark as paid</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(inv.id)}>Duplicate</DropdownMenuItem>
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
      )}
    </div>
  );
}
