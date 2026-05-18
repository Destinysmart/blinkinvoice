import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Zap, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useAppStore, invoiceTotal } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { createLnUsdInvoice, createLnBtcInvoice } from "@/lib/blink";
import type { InvoiceStatus } from "@/lib/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/invoices/$id")({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invoice = useAppStore((s) => s.invoices.find((i) => i.id === id));
  const settings = useAppStore((s) => s.settings);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button asChild className="mt-4"><Link to="/invoices">Back</Link></Button>
      </div>
    );
  }

  const { subtotal, tax, total } = invoiceTotal(invoice);
  const unit = invoice.currency === "USD" ? "$" : "sats";
  const fmt = (n: number) => (invoice.currency === "USD" ? `$${n.toFixed(2)}` : `${Math.round(n).toLocaleString()} sats`);

  const ln = useMutation({
    mutationFn: async () => {
      if (!settings.apiKey || !settings.walletId) throw new Error("Configure API key & wallet in Settings");
      const memo = `${invoice.number} — ${invoice.client.name}`;
      if (invoice.currency === "USD") {
        return createLnUsdInvoice(settings.apiKey, settings.walletId, Math.round(total * 100), memo);
      }
      return createLnBtcInvoice(settings.apiKey, settings.walletId, Math.round(total), memo);
    },
    onSuccess: (inv) => {
      updateInvoice(id, {
        paymentRequest: inv.paymentRequest,
        paymentHash: inv.paymentHash,
        satoshis: inv.satoshis,
        expiresAt: Date.now() + 1000 * 60 * 60,
      });
      toast.success("Lightning invoice generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = (status: InvoiceStatus) => {
    updateInvoice(id, { status });
    toast.success(`Marked as ${status}`);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const lnUri = invoice.paymentRequest ? `lightning:${invoice.paymentRequest}` : "";
  const missingKeys = !settings.apiKey || !settings.walletId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Link>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button><StatusBadge status={invoice.status} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatus("draft")}>Draft</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus("pending")}>Pending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus("paid")}>Paid</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {invoice.status !== "paid" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("paid")}>Mark as paid</Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { deleteInvoice(id); navigate({ to: "/invoices" }); }}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill to</p>
            <p className="mt-2 font-display text-xl font-bold">{invoice.client.name}</p>
            <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.client.address}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold">{settings.businessName || "Your business"}</p>
            <p className="text-sm text-muted-foreground">{settings.businessEmail}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{settings.businessAddress}</p>
            <div className="mt-4 font-mono text-sm">{invoice.number}</div>
            <div className="text-xs text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        <table className="mt-8 w-full">
          <thead className="border-y border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-border">
                <td className="py-3 text-sm">{it.desc || <span className="text-muted-foreground">—</span>}</td>
                <td className="py-3 text-right font-mono text-sm">{it.qty}</td>
                <td className="py-3 text-right font-mono text-sm">{fmt(it.price)}</td>
                <td className="py-3 text-right font-mono text-sm">{fmt(it.qty * it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-full max-w-xs space-y-1 font-mono text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Tax ({invoice.tax}%)</span><span>{fmt(tax)}</span></div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-bold text-primary">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>

        {invoice.memo && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memo</p>
            <p className="mt-1 text-sm whitespace-pre-line">{invoice.memo}</p>
          </div>
        )}
      </div>

      {/* Lightning section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 fill-primary text-primary" />
          <h2 className="font-display text-xl font-bold">Lightning payment</h2>
        </div>

        {missingKeys && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning" style={{ color: "var(--warning)" }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Add your Blink API key and Wallet ID in{" "}
              <Link to="/settings" className="underline font-medium">Settings</Link> before generating an invoice.
            </span>
          </div>
        )}

        {!invoice.paymentRequest ? (
          <Button onClick={() => ln.mutate()} disabled={ln.isPending || missingKeys}>
            {ln.isPending ? "Generating…" : "Generate Lightning Invoice"}
          </Button>
        ) : (
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="rounded-md bg-white p-3">
              <QRCodeSVG value={lnUri} size={200} level="M" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
                <p className="font-mono text-2xl font-bold text-primary">
                  {invoice.satoshis?.toLocaleString()} sats
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">BOLT11</p>
                <div className="mt-1 flex items-start gap-2">
                  <code className="flex-1 break-all rounded border border-border bg-[var(--surface)] p-2 text-xs">
                    {invoice.paymentRequest}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copy(invoice.paymentRequest!, "BOLT11")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(lnUri, "Lightning URI")}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy lightning: URI
                </Button>
                <Button size="sm" variant="outline" onClick={() => ln.mutate()} disabled={ln.isPending}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                </Button>
              </div>
              {invoice.expiresAt && <Countdown until={invoice.expiresAt} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const remaining = useMemo(() => Math.max(0, until - Date.now()), [until]);
  const [n, setN] = useState(remaining);
  useState(() => {
    const id = setInterval(() => setN(Math.max(0, until - Date.now())), 1000);
    return () => clearInterval(id);
  });
  const mins = Math.floor(n / 60000);
  const secs = Math.floor((n % 60000) / 1000);
  return (
    <p className="text-xs text-muted-foreground">
      Expires in <span className="font-mono">{mins}:{String(secs).padStart(2, "0")}</span>
    </p>
  );
}
