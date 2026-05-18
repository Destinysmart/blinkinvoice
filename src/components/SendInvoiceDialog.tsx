import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { sendInvoiceEmail } from "@/lib/email.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  settings: Settings;
  onSent?: () => void;
}

export function SendInvoiceDialog({ open, onOpenChange, invoice, settings, onSent }: Props) {
  const { total } = invoiceTotal(invoice);
  const amount = invoice.currency === "USD" ? `$${total.toFixed(2)}` : `${Math.round(total).toLocaleString()} sats`;
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const businessName = settings.businessName || "BlinkPay";

  const defaultSubject = `Invoice ${invoice.number} from ${businessName}`;
  const defaultMessage =
    `Hi ${invoice.client.name},\n\n` +
    `Please find attached invoice ${invoice.number} for ${amount}${dueDate ? ` due on ${dueDate}` : ""}.\n\n` +
    `You can pay instantly via Bitcoin Lightning — the QR code is included in the attached PDF.\n\n` +
    `Thank you for your business.\n${businessName}`;

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

  const html = useMemo(() => buildHtml({ message, businessName, amount, invoice }), [message, businessName, amount, invoice]);

  const sendFn = useServerFn(sendInvoiceEmail);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const { downloadInvoicePDF, renderInvoicePDFBlob } = await import("./InvoicePDF");
      void downloadInvoicePDF; // keep import used
      const blob = await renderInvoicePDFBlob(invoice, settings);
      const base64 = await blobToBase64(blob);
      return sendFn({
        data: {
          invoiceId: invoice.id.includes("-") ? invoice.id : undefined,
          to,
          subject,
          html,
          fromName: businessName,
          pdfBase64: base64,
          pdfFileName: `${invoice.number}.pdf`,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Invoice sent to ${to}`);
      qc.invalidateQueries({ queryKey: ["email-logs", invoice.id] });
      onSent?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send invoice via email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="se-to">To</Label>
            <Input id="se-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="se-subj">Subject</Label>
            <Input id="se-subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="se-msg">Message</Label>
            <Textarea id="se-msg" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            PDF attached automatically. Sent via Resend{settings.businessEmail ? "" : " (from onboarding@resend.dev — verify a domain at resend.com/domains to send from your own address)"}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !to || !subject}>
            {mut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            {mut.isPending ? "Sending…" : "Send invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildHtml({ message, businessName, amount, invoice }: { message: string; businessName: string; amount: string; invoice: Invoice }) {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0b0b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#eaeaea">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden">
        <tr><td style="padding:20px 24px;border-bottom:1px solid #262626"><div style="font-size:18px;font-weight:700;color:#F7931A">${escapeHtml(businessName)}</div></td></tr>
        <tr><td style="padding:24px">
          <div style="font-size:14px;line-height:1.6;color:#dadada">${escaped}</div>
          <table cellpadding="0" cellspacing="0" style="margin-top:20px;background:#0b0b0b;border:1px solid #262626;border-radius:8px;width:100%">
            <tr><td style="padding:14px 16px">
              <div style="font-size:12px;color:#888">Invoice</div>
              <div style="font-size:16px;font-weight:600;color:#eaeaea">${escapeHtml(invoice.number)}</div>
              <div style="font-size:22px;font-weight:700;color:#F7931A;margin-top:6px">${escapeHtml(amount)}</div>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#888;margin:18px 0 0">The full invoice and Lightning payment QR are in the attached PDF.</p>
        </td></tr>
        <tr><td style="padding:14px 24px;border-top:1px solid #262626;font-size:11px;color:#666">Sent by ${escapeHtml(businessName)} via BlinkPay</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
