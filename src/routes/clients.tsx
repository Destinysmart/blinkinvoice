import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore, invoiceTotal } from "@/lib/store";
import type { Client } from "@/lib/types";
import { fmtUsd, fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
});

type Row = {
  id?: string;
  name: string;
  email: string;
  address: string;
  total: number;
  outstanding: number;
  count: number;
  last: string | null;
  saved: boolean;
};

function ClientsPage() {
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const addClient = useAppStore((s) => s.addClient);
  const updateClient = useAppStore((s) => s.updateClient);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const seedDemo = useAppStore((s) => s.seedDemo);
  const navigate = useNavigate();

  useEffect(() => { seedDemo(); }, [seedDemo]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const rows: Row[] = useMemo(() => {
    const byName = new Map<string, Row>();
    // start with saved clients
    for (const c of clients) {
      byName.set(c.name, {
        id: c.id, name: c.name, email: c.email, address: c.address,
        total: 0, outstanding: 0, count: 0, last: null, saved: true,
      });
    }
    // merge invoice-derived stats
    for (const inv of invoices) {
      const key = inv.client.name;
      const t = invoiceTotal(inv).total;
      const usd = inv.currency === "USD" ? t : 0;
      const cur = byName.get(key) ?? {
        name: inv.client.name, email: inv.client.email, address: inv.client.address,
        total: 0, outstanding: 0, count: 0, last: null, saved: false,
      };
      cur.total += usd;
      if (inv.status === "pending") cur.outstanding += usd;
      cur.count += 1;
      if (!cur.last || new Date(inv.createdAt) > new Date(cur.last)) cur.last = inv.createdAt;
      if (!cur.email) cur.email = inv.client.email;
      if (!cur.address) cur.address = inv.client.address;
      byName.set(key, cur);
    }
    return [...byName.values()].sort((a, b) => b.total - a.total);
  }, [invoices, clients]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setOpen(true); };

  const onSave = (data: { name: string; email: string; address: string }) => {
    if (!data.name.trim()) { toast.error("Name is required"); return; }
    if (editing) {
      updateClient(editing.id, data);
      toast.success("Client updated");
    } else {
      const c: Client = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      addClient(c);
      toast.success("Client added");
    }
    setOpen(false);
  };

  const onDelete = (c: Client) => {
    if (!confirm(`Delete ${c.name}? Existing invoices won't change.`)) return;
    deleteClient(c.id);
    toast.success("Client deleted");
  };

  const newInvoiceFor = (r: Row) => {
    navigate({
      to: "/invoices/new",
      search: { name: r.name, email: r.email, address: r.address },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage who you bill and start new invoices in one click.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add client
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to send invoices faster."
          action={<Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add client</Button>}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id ?? c.name} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.email || "—"}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                      <span>{c.count} inv</span>
                      <span>{fmtUsd(c.total)}</span>
                      {c.outstanding > 0 && <span className="text-primary">{fmtUsd(c.outstanding)} due</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => newInvoiceFor(c)} aria-label="New invoice">
                    <FilePlus2 className="h-4 w-4" />
                  </Button>
                  {c.saved && c.id && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEdit({
                        id: c.id!, name: c.name, email: c.email, address: c.address, createdAt: "",
                      })} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete({
                        id: c.id!, name: c.name, email: c.email, address: c.address, createdAt: "",
                      })} aria-label="Delete" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-left font-medium">Last invoice</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id ?? c.name} className="border-b border-border last:border-0 hover:bg-[var(--surface)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                          {initials(c.name)}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{c.name}</span>
                          {!c.saved && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From invoice</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{fmtUsd(c.total)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-primary">{c.outstanding ? fmtUsd(c.outstanding) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{c.count}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.last ? fmtDate(c.last) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => newInvoiceFor(c)} title="New invoice">
                          <FilePlus2 className="h-4 w-4" />
                        </Button>
                        {c.saved && c.id && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit({
                              id: c.id!, name: c.name, email: c.email, address: c.address, createdAt: "",
                            })} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onDelete({
                              id: c.id!, name: c.name, email: c.email, address: c.address, createdAt: "",
                            })} title="Delete" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {!c.saved && (
                          <Button variant="ghost" size="sm" title="Save as client" onClick={() => {
                            addClient({ id: crypto.randomUUID(), name: c.name, email: c.email, address: c.address, createdAt: new Date().toISOString() });
                            toast.success("Saved to clients");
                          }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>

      )}

      <ClientDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={onSave}
      />
    </div>
  );
}

function ClientDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Client | null;
  onSave: (data: { name: string; email: string; address: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
      setAddress(initial?.address ?? "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>Save client details to reuse them on future invoices.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ name, email, address })}>
            {initial ? "Save changes" : "Add client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
