import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Zap, AlertTriangle, RefreshCw, Trash2, Download, Share2, Eye, MoreHorizontal, CheckCircle2, Send } from "lucide-react";
import { useWalletConnect } from "lightningconnect";
import { useAppStore, invoiceTotal, genInvoiceNumber } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDialog, PreviewDialog } from "@/components/ShareDialog";
import { SendInvoiceDialog, EmailHistory } from "@/components/SendInvoiceDialog";
import { Mail } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/invoices/$id")({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invoice = useAppStore((s) => s.invoices.find((i) => i.id === id));
  const allInvoices = useAppStore((s) => s.invoices);
  const settings = useAppStore((s) => s.settings);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);
  const addInvoice = useAppStore((s) => s.addInvoice);

  const { isConnected, makeInvoice, lookupInvoice, connect } = useWalletConnect();

  const sendAgain = () => {
    if (!invoice) return;
    const newId = crypto.randomUUID();
    const number = genInvoiceNumber(
      allInvoices.map((i) => i.number),
      settings.invoicePrefix || "INV",
    );
    addInvoice({
      ...invoice,
      id: newId,
      number,
      status: "draft",
      issueDate: new Date().toISOString(),
      paymentRequest: null,
      paymentHash: null,
      satoshis: null,
      expiresAt: null,
      verifyUrl: null,
      activity: [],
      createdAt: new Date().toISOString(),
    });
    toast.success("Invoice duplicated");
    navigate({ to: "/invoices/$id", params: { id: newId }, search: { send: 1 } as any });
  };

  const ln = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Invoice not found");
      if (!isConnected) throw new Error("Connect your wallet in Settings first");
      const { total } = invoiceTotal(invoice);
      if (!invoice.items.length || total <= 0) {
        throw new Error("Add at least one item with a price before generating a payment link.");
      }
      const memo = (invoice.memo && invoice.memo.trim())
        ? invoice.memo.trim()
        : `${invoice.number} — ${invoice.client.name}`;
      // BTC invoices: pass sats. USD invoices: pass cents.
      const amount = invoice.currency === "USD" ? Math.round(total * 100) : Math.round(total);
      return makeInvoice(amount, invoice.currency, memo);
    },
    onSuccess: (inv) => {
      updateInvoice(id, {
        paymentRequest: inv.bolt11,
        paymentHash: inv.paymentHash,
        satoshis: inv.amount,
        expiresAt: inv.expiresAt * 1000,
        verifyUrl: (inv as any).verify ?? null,
      });
      toast.success("Lightning invoice generated");
    },
    onError: (e: Error) => {
      // Friendly fallback — never surface raw BOLT11/wallet errors.
      const msg = e.message?.includes("item with a price") || e.message?.includes("Settings")
        ? e.message
        : "Couldn't generate a payment link right now. Please try again.";
      toast.error(msg);
    },
  });

  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("send") === "1") {
      setSendOpen(true);
      p.delete("send");
      const q = p.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    }
  }, [id]);

  // Poll Lightning payment status every 5s while invoice is outstanding.
  // Requires either an active wallet connection OR a stored verify URL.
  const polling =
    !!invoice?.paymentRequest &&
    !!invoice?.paymentHash &&
    invoice?.status !== "paid" &&
    (isConnected || !!invoice?.verifyUrl) &&
    (!invoice?.expiresAt || invoice.expiresAt > Date.now());

  useEffect(() => {
    if (!polling || !invoice?.paymentHash) return;
    let cancelled = false;
    const check = async () => {
      try {
        const status = await lookupInvoice(invoice.paymentHash!, {
          bolt11: invoice.paymentRequest!,
          paymentHash: invoice.paymentHash!,
          amount: invoice.satoshis ?? 0,
          memo: "",
          createdAt: 0,
          expiresAt: invoice.expiresAt ? Math.floor(invoice.expiresAt / 1000) : 0,
          verify: invoice.verifyUrl ?? undefined,
        });
        if (cancelled) return;
        if (status === "PAID") {
          updateInvoice(id, {
            status: "paid",
            activity: [
              ...(invoice.activity ?? []),
              { at: new Date().toISOString(), text: "Payment received via Lightning" },
            ],
          });
          setJustPaid(true);
          toast.success("Payment received");
        }
      } catch {
        /* ignore transient errors and keep polling */
      }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, invoice?.paymentHash, id]);

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button asChild className="mt-4"><Link to="/invoices">Back</Link></Button>
      </div>
    );
  }

  const { subtotal, tax, total } = invoiceTotal(invoice);
  const fmt = (n: number) => (invoice.currency === "USD" ? `$${n.toFixed(2)}` : `${Math.round(n).toLocaleString()} sats`);

  const setStatus = (status: InvoiceStatus) => {
    updateInvoice(id, { status });
    toast.success(`Marked as ${status}`);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const lnUri = invoice.paymentRequest ? `lightning:${invoice.paymentRequest}` : "";
  const walletMissing = !isConnected;
  const hasAmount = invoice.items.length > 0 && total > 0;
  const memoForClient = (invoice.memo && invoice.memo.trim())
    ? invoice.memo.trim()
    : `${invoice.number} — ${invoice.client.name}`;

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadInvoicePDF } = await import("@/components/InvoicePDF");
      await downloadInvoicePDF(invoice, settings);
      toast.success("PDF downloaded");
    }
    catch (e: any) { toast.error(e?.message ?? "Failed to generate PDF"); }
    finally { setDownloading(false); }
  };

  const onShared = (channel: "WhatsApp" | "Email") => {
    const entry = { at: new Date().toISOString(), text: `Shared via ${channel}` };
    const activity = [...(invoice.activity ?? []), entry];
    const patch: Partial<typeof invoice> = { activity };
    if (invoice.status === "draft") patch.status = "pending";
    updateInvoice(id, patch);
    toast.success(`Opened ${channel}`);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Primary action: always visible */}
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Mail className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Send</span>
          </Button>

          {/* Desktop / tablet: inline secondary actions */}
          {invoice.status !== "paid" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("paid")} className="hidden sm:inline-flex">Mark as paid</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} aria-label="Preview" className="hidden sm:inline-flex">
            <Eye className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button size="sm" variant="outline" onClick={download} disabled={downloading} aria-label="Download" className="hidden sm:inline-flex">
            <Download className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{downloading ? "Generating…" : "Download"}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} aria-label="Share" className="hidden sm:inline-flex">
            <Share2 className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Button size="sm" variant="outline" onClick={sendAgain} aria-label="Send again" className="hidden sm:inline-flex">
            <Send className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Send again</span>
          </Button>

          {/* Mobile: collapse secondary actions into one menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="More actions" className="sm:hidden">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {invoice.status !== "paid" && (
                <DropdownMenuItem onClick={() => setStatus("paid")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as paid
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={download} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" /> {downloading ? "Generating…" : "Download"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={sendAgain}>
                <Send className="mr-2 h-4 w-4" /> Send again
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Delete">
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


      <div className="rounded-lg border border-border bg-card p-4 sm:p-6 md:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="order-2 sm:order-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill to</p>
            <p className="mt-2 font-display text-lg font-bold sm:text-xl">{invoice.client.name}</p>
            <p className="text-sm text-muted-foreground break-words">{invoice.client.email}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.client.address}</p>
          </div>
          <div className="order-1 sm:order-2 sm:text-right">
            {settings.logo && <img src={settings.logo} alt="logo" className="mb-2 h-10 rounded bg-white p-1 object-contain sm:ml-auto sm:h-12" />}
            <p className="font-display text-xl font-bold sm:text-2xl">{settings.businessName || "Your business"}</p>
            <p className="text-sm text-muted-foreground break-words">{settings.businessEmail}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{settings.businessAddress}</p>
            <div className="mt-4 font-mono text-sm">{invoice.number}</div>
            <div className="text-xs text-muted-foreground">Issued {new Date(invoice.issueDate ?? invoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
            {invoice.dueDate && <div className="text-xs text-muted-foreground">Due {new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>}
          </div>
        </div>

        {/* Items — table on sm+, stacked cards on mobile */}
        <div className="mt-6 sm:mt-8">
          <table className="hidden w-full sm:table">
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
          <ul className="space-y-2 sm:hidden">
            {invoice.items.map((it) => (
              <li key={it.id} className="rounded-md border border-border bg-[var(--surface)] p-3">
                <div className="text-sm font-medium break-words">{it.desc || <span className="text-muted-foreground">—</span>}</div>
                <div className="mt-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
                  <span>{it.qty} × {fmt(it.price)}</span>
                  <span className="font-semibold text-foreground">{fmt(it.qty * it.price)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>


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
        {settings.invoiceFooter && (
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">{settings.invoiceFooter}</p>
        )}
      </div>

      {/* Lightning section */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 fill-primary text-primary" />
            <h2 className="font-display text-lg font-bold sm:text-xl">Lightning payment</h2>
          </div>
          {polling && (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary animate-pulse">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Watching for payment
            </span>
          )}
        </div>

        {(invoice.status === "paid" && (justPaid || invoice.paymentRequest)) && justPaid && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm font-medium text-success animate-in fade-in slide-in-from-top-2 duration-500" style={{ color: "var(--success)" }}>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/20 animate-pulse">✓</span>
            Payment confirmed — invoice marked as paid.
          </div>
        )}


        {walletMissing && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning" style={{ color: "var(--warning)" }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Connect a Lightning wallet in{" "}
              <Link to="/settings" className="underline font-medium">Settings</Link> before generating an invoice,
              or{" "}
              <button onClick={connect} className="underline font-medium">connect now</button>.
            </span>
          </div>
        )}

        {!hasAmount && !invoice.paymentRequest && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">No amount set yet</p>
              <p className="text-muted-foreground">Add at least one item with a price before generating a payment link.</p>
            </div>
          </div>
        )}

        {/* Payment note for client — editable, defaults to invoice number + client name */}
        {!invoice.paymentRequest && (
          <div className="mb-4 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Payment note for client</label>
            <input
              type="text"
              value={invoice.memo ?? ""}
              onChange={(e) => updateInvoice(id, { memo: e.target.value })}
              placeholder={`${invoice.number} — ${invoice.client.name}`}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on the payment page and in the Lightning invoice memo. Leave blank to auto-fill with the invoice number and client name.
            </p>
          </div>
        )}

        {!invoice.paymentRequest ? (
          <Button
            onClick={() => ln.mutate()}
            disabled={ln.isPending || walletMissing || !hasAmount}
            className="w-full sm:w-auto"
            title={
              walletMissing ? "Connect your wallet in Settings first"
              : !hasAmount ? "Add at least one item with a price"
              : undefined
            }
          >
            {ln.isPending ? "Generating…" : "Generate Lightning Invoice"}
          </Button>
        ) : (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto rounded-md bg-white p-3 sm:mx-0">
              <QRCodeSVG value={lnUri} size={180} level="M" className="h-auto w-full max-w-[200px]" />
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

      {invoice.activity && invoice.activity.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</h2>
          <ul className="space-y-2">
            {invoice.activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{a.text}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <EmailHistory invoiceId={invoice.id} />

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} invoice={invoice} settings={settings} onShared={onShared} />
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} invoice={invoice} settings={settings} />
      <SendInvoiceDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        invoice={invoice}
        settings={settings}
        onSent={(email) => {
          const entry = { at: new Date().toISOString(), text: `Emailed to ${email}` };
          const activity = [...(invoice.activity ?? []), entry];
          const patch: Partial<typeof invoice> = { activity, sentAt: new Date().toISOString() } as any;
          if (invoice.status === "draft") patch.status = "pending";
          updateInvoice(id, patch);
        }}
      />
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const [n, setN] = useState(Math.max(0, until - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setN(Math.max(0, until - Date.now())), 1000);
    return () => clearInterval(id);
  }, [until]);
  const mins = Math.floor(n / 60000);
  const secs = Math.floor((n % 60000) / 1000);
  return (
    <p className="text-xs text-muted-foreground">
      Expires in <span className="font-mono">{mins}:{String(secs).padStart(2, "0")}</span>
    </p>
  );
}
