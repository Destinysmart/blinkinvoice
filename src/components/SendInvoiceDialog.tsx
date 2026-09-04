import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Send, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";
import { sendInvoiceEmail, listInvoiceEmailLogs } from "@/lib/email.functions";
import { fmtDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  settings: Settings;
  onSent?: (email: string) => void;
}

function fmtAmount(inv: Invoice) {
  const { total } = invoiceTotal(inv);
  return inv.currency === "USD" ? `$${total.toFixed(2)}` : `${Math.round(total).toLocaleString()} sats`;
}

function applyVars(s: string, inv: Invoice, settings: Settings) {
  const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  return s
    .replaceAll("{number}", inv.number)
    .replaceAll("{businessName}", settings.businessName || "BlinkInvoice")
    .replaceAll("{clientName}", inv.client.name || "")
    .replaceAll("{amount}", fmtAmount(inv))
    .replaceAll("{dueDate}", dueDate);
}

function buildHtml(message: string, inv: Invoice, settings: Settings, payUrl: string | null) {
  const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const para = applyVars(message, inv, settings).split("\n").map(l => `<p style="margin:0 0 12px;color:#cccccc;font-size:14px;line-height:1.6">${escapeHtml(l)}</p>`).join("");
  const payButton = payUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0">
      <tr><td align="center">
        <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:#F7931A;color:#0a0a0a;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px">⚡ Pay invoice</a>
        <div style="color:#888;font-size:12px;margin-top:10px">The Lightning QR refreshes automatically — never expires.</div>
      </td></tr>
    </table>` : "";
  const pdfButton = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0">
      <tr><td align="center">
        <a href="{{PDF_URL}}" style="display:inline-block;background:#1c1c1c;border:1px solid #2a2a2a;color:#F7931A;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px">📄 Download invoice PDF</a>
      </td></tr>
    </table>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden">
  <tr><td style="background:linear-gradient(135deg,#F7931A,#cc6f0a);padding:24px 28px;color:#fff">
    <div style="font-size:12px;letter-spacing:2px;opacity:.85">INVOICE</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(inv.number)}</div>
  </td></tr>
  <tr><td style="padding:28px">
    ${para}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:8px">
      <tr><td style="padding:16px 18px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Amount due</td>
          <td align="right" style="padding:16px 18px;color:#F7931A;font-weight:700;font-size:20px;font-family:monospace">${escapeHtml(fmtAmount(inv))}</td></tr>
      <tr><td style="padding:0 18px 14px;color:#888;font-size:12px">Due date</td>
          <td align="right" style="padding:0 18px 14px;color:#cccccc;font-size:13px">${escapeHtml(dueDate)}</td></tr>
      <tr><td style="padding:0 18px 16px;color:#888;font-size:12px">Bill to</td>
          <td align="right" style="padding:0 18px 16px;color:#cccccc;font-size:13px">${escapeHtml(inv.client.name)}</td></tr>
    </table>
    ${payButton}
    ${pdfButton}
    <p style="color:#888;font-size:13px;margin:16px 0 0">Tap the button above to download the full invoice PDF (with Lightning QR).</p>

  </td></tr>
  <tr><td style="padding:18px 28px;border-top:1px solid #2a2a2a;color:#666;font-size:11px;text-align:center">
    ${escapeHtml(settings.businessName || "BlinkInvoice")} · Bitcoin-native invoicing
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function SendInvoiceDialog({ open, onOpenChange, invoice, settings, onSent }: Props) {
  const defaultSubject = `Invoice ${invoice.number} from ${settings.businessName || "BlinkInvoice"}`;
  const defaultMessage = `Hi ${invoice.client.name},\n\nPlease find your invoice ${invoice.number} for ${fmtAmount(invoice)} below. You can download the full PDF from the button in the email.\n\nYou can also pay instantly via Bitcoin Lightning — just tap the Pay button.\n\nThank you for your business.\n${settings.businessName || ""}`;

  const [to, setTo] = useState(invoice.client.email || "");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);

  useEffect(() => {
    if (open) {
      setTo(invoice.client.email || "");
      setSubject(defaultSubject);
      setMessage(defaultMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id]);

  const sendFn = useServerFn(sendInvoiceEmail);
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: async () => {
      if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw new Error("Enter a valid recipient email");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Create a free account or sign in to email invoices. You can still download or share the PDF.");
      }
      const [{ pdf }, { InvoicePDF }, QR] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./InvoicePDF"),
        import("qrcode"),
      ]);
      let qrCodeDataURL: string | null = null;
      if (invoice.paymentRequest) {
        qrCodeDataURL = await QR.default.toDataURL(`lightning:${invoice.paymentRequest}`, {
          width: 220, margin: 2, color: { dark: "#000000", light: "#FFFFFF" },
        });
      }
      const blob = await pdf(<InvoicePDF invoice={invoice} settings={settings} qrCodeDataURL={qrCodeDataURL} />).toBlob();
      const buf = await blob.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const pdfBase64 = btoa(bin);

      return sendFn({
        data: {
          invoiceId: invoice.id,
          to,
          subject,
          html: buildHtml(message, invoice, settings, invoice.payToken ? `${window.location.origin}/pay/${invoice.payToken}` : null),
          pdfBase64,
          pdfFilename: `${invoice.number}.pdf`,
          fromName: settings.businessName || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Invoice sent to ${to}`);
      qc.invalidateQueries({ queryKey: ["email_logs", invoice.id] });
      onSent?.(to);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Send invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
          </div>
          <div>
            <Label htmlFor="subj">Subject</Label>
            <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="msg">Message</Label>
            <Textarea id="msg" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The PDF (with Lightning QR) is uploaded and linked from the email. Sent from <span className="font-mono">invoices@notify.bitlance.work</span>.
          </p>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> {send.isPending ? "Sending…" : "Send invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailHistory({ invoiceId }: { invoiceId: string }) {
  const listFn = useServerFn(listInvoiceEmailLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["email_logs", invoiceId],
    queryFn: () => listFn({ data: { invoiceId } }),
  });
  const logs = data?.logs ?? [];
  if (isLoading) return null;
  if (logs.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email history</h2>
      <ul className="space-y-2">
        {logs.map((l: any) => {
          const s: "queued" | "sent" | "failed" | "suppressed" = l.delivery_status ?? "queued";
          const icon = s === "sent"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            : s === "failed" || s === "suppressed"
              ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              : <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
          const label = s === "sent" ? "Sent to "
            : s === "failed" ? "Failed sending to "
            : s === "suppressed" ? "Suppressed — not sent to "
            : "Queued for ";
          return (
            <li key={l.id} className="flex items-start gap-3 text-sm">
              {icon}
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {label}
                  <span className="font-medium">{l.recipient_email}</span>
                </div>
                {l.subject && <div className="truncate text-xs text-muted-foreground">{l.subject}</div>}
                {l.delivery_error && <div className="text-xs text-destructive break-words">{l.delivery_error}</div>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
