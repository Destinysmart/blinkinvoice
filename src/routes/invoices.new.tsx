import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore, invoiceTotal, genInvoiceNumber } from "@/lib/store";
import type { Currency, Invoice, LineItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/invoices/new")({
  component: NewInvoicePage,
});

function newItem(): LineItem {
  return { id: crypto.randomUUID(), desc: "", qty: 1, price: 0 };
}

function NewInvoicePage() {
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const invoices = useAppStore((s) => s.invoices);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const saveSettings = useAppStore((s) => s.saveSettings);

  const termsDays = settings.defaultPaymentTermsDays ?? 14;
  const today = new Date();
  const defaultDue = new Date(today); defaultDue.setDate(defaultDue.getDate() + termsDays);

  const [client, setClient] = useState({ name: "", email: "", address: "" });
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [tax, setTax] = useState(settings.defaultTaxRate ?? 0);
  const [memo, setMemo] = useState("");
  const [issueDate, setIssueDate] = useState(today.toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().slice(0, 10));

  const { subtotal, tax: taxAmt, total } = invoiceTotal({ items, tax });

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const setNet = (days: number) => {
    const d = new Date(issueDate); d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  };

  const save = (status: "draft" | "pending") => {
    if (!client.name.trim()) { toast.error("Client name is required"); return; }
    const next = settings.nextInvoiceNumber ?? 1;
    const inv: Invoice = {
      id: crypto.randomUUID(),
      number: genInvoiceNumber(invoices.map((i) => i.number), settings.invoicePrefix ?? "INV", next),
      client, items, currency, tax, memo, status,
      issueDate: new Date(issueDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null,
      createdAt: new Date().toISOString(),
    };
    addInvoice(inv);
    saveSettings({ nextInvoiceNumber: next + 1 });
    toast.success(status === "draft" ? "Draft saved" : "Invoice created");
    navigate({ to: "/invoices/$id", params: { id: inv.id } });
  };

  const unit = currency === "USD" ? "$" : "sats";

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold">New invoice</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="From">
          <p className="font-medium">{settings.businessName || <span className="text-muted-foreground">Set in Settings</span>}</p>
          <p className="text-sm text-muted-foreground">{settings.businessEmail}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{settings.businessAddress}</p>
        </Section>

        <Section title="Bill to">
          <div className="space-y-3">
            <Field label="Name *"><Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
            <Field label="Address"><Textarea rows={2} value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} /></Field>
          </div>
        </Section>
      </div>

      <Section title="Details">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Issue date">
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Payment terms">
            <div className="flex flex-wrap gap-1">
              {[7, 14, 30, 60].map((d) => (
                <button key={d} type="button" onClick={() => setNet(d)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary">
                  Net {d}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Label className="text-sm">Currency</Label>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["USD", "BTC"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-sm px-3 py-1 text-xs font-medium transition ${
                  currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "BTC" ? "BTC (sats)" : "USD"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-border">
          <table className="w-full">
            <thead className="bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-left font-medium">Qty</th>
                <th className="w-32 px-3 py-2 text-left font-medium">Price ({unit})</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-2 py-1"><Input value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} placeholder="Item description" /></td>
                  <td className="px-2 py-1"><Input type="number" min={0} value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })} /></td>
                  <td className="px-2 py-1"><Input type="number" min={0} value={it.price} onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2 text-right font-mono text-sm">{(it.qty * it.price).toLocaleString()}</td>
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => setItems((arr) => arr.filter((x) => x.id !== it.id))} className="text-muted-foreground hover:text-destructive" disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setItems([...items, newItem()])} className="mt-2">
          <Plus className="mr-1 h-4 w-4" /> Add line
        </Button>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Tax %"><Input type="number" min={0} value={tax} onChange={(e) => setTax(Number(e.target.value))} /></Field>
            <Field label="Memo / Notes"><Textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
          </div>

          <div className="rounded-md border border-border bg-[var(--surface)] p-4 font-mono text-sm">
            <Row label="Subtotal" val={subtotal} unit={unit} />
            <Row label={`Tax (${tax}%)`} val={taxAmt} unit={unit} />
            <div className="my-2 border-t border-border" />
            <Row label="Total" val={total} unit={unit} big />
          </div>
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => save("draft")}>Save as Draft</Button>
        <Button onClick={() => save("pending")}>Create Invoice</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, val, unit, big }: { label: string; val: number; unit: string; big?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${big ? "text-lg font-bold text-primary" : ""}`}>
      <span className={big ? "" : "text-muted-foreground"}>{label}</span>
      <span>{unit === "$" ? `$${val.toFixed(2)}` : `${Math.round(val).toLocaleString()} sats`}</span>
    </div>
  );
}
