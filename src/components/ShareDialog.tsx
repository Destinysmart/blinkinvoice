import { useState } from "react";
import { Download, Link2, MessageCircle, Mail, X } from "lucide-react";
import { toast } from "sonner";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  settings: Settings;
  onShared?: (channel: "WhatsApp" | "Email") => void;
}

export function ShareDialog({ open, onOpenChange, invoice, settings, onShared }: Props) {
  const [loading, setLoading] = useState(false);
  const { total } = invoiceTotal(invoice);
  const amount = invoice.currency === "USD" ? `$${total.toFixed(2)}` : `${Math.round(total).toLocaleString()} sats`;
  const url = typeof window !== "undefined" ? `${window.location.origin}/invoices/${invoice.id}` : "";
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

  const download = async () => {
    setLoading(true);
    try {
      const { downloadInvoicePDF } = await import("./InvoicePDF");
      await downloadInvoicePDF(invoice, settings);
      toast.success("PDF downloaded");
    }
    catch (e: any) { toast.error(e?.message ?? "Failed to generate PDF"); }
    finally { setLoading(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const whatsapp = () => {
    const text = encodeURIComponent(
      `Hi ${invoice.client.name}, please find your invoice ${invoice.number} for ${amount} attached. You can pay instantly via Bitcoin Lightning. ${url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
    onShared?.("WhatsApp");
    onOpenChange(false);
  };

  const email = () => {
    const subject = encodeURIComponent(`Invoice ${invoice.number} from ${settings.businessName || "BlinkInvoice"}`);
    const body = encodeURIComponent(
      `Hi ${invoice.client.name},\n\nPlease find attached your invoice ${invoice.number} for ${amount}${dueDate ? ` due on ${dueDate}` : ""}.\n\nYou can pay instantly via Bitcoin Lightning Network.\n\nThank you for your business.\n\n${settings.businessName || ""}`
    );
    window.location.href = `mailto:${invoice.client.email}?subject=${subject}&body=${body}`;
    onShared?.("Email");
    onOpenChange(false);
  };

  const options = [
    { icon: Download, title: "Download PDF", desc: "Save a copy to your device", onClick: download, disabled: loading },
    { icon: Link2, title: "Copy shareable link", desc: "Paste in any messenger", onClick: copyLink },
    { icon: MessageCircle, title: "Share via WhatsApp", desc: "Pre-filled message with invoice details", onClick: whatsapp },
    { icon: Mail, title: "Open email client", desc: "Pre-fill an email to your client", onClick: email, disabled: !invoice.client.email },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.title}
              onClick={o.onClick}
              disabled={o.disabled}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                <o.icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PreviewDialog({ open, onOpenChange, invoice, settings }: Omit<Props, "onShared">) {
  const [PDFViewer, setPDFViewer] = useState<any>(null);
  const [InvoicePDFComp, setInvoicePDFComp] = useState<any>(null);
  const [qrDataURL, setQrDataURL] = useState<string | null>(null);

  const downloadPreview = async () => {
    try {
      const { downloadInvoicePDF } = await import("./InvoicePDF");
      await downloadInvoicePDF(invoice, settings);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    }
  };

  // Lazy-load on open
  if (open && !PDFViewer) {
    Promise.all([
      import("@react-pdf/renderer"),
      import("./InvoicePDF"),
      import("qrcode"),
    ]).then(async ([rp, ip, qr]) => {
      setPDFViewer(() => rp.PDFViewer);
      setInvoicePDFComp(() => ip.InvoicePDF);
      if (invoice.paymentRequest) {
        const url = await qr.default.toDataURL(`lightning:${invoice.paymentRequest}`, {
          width: 220, margin: 2, color: { dark: "#000000", light: "#FFFFFF" },
        });
        setQrDataURL(url);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] p-0 flex flex-col gap-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3 space-y-0">
          <DialogTitle>Preview · {invoice.number}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadPreview}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </Button>
            <button onClick={() => onOpenChange(false)} className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <div className="flex-1 bg-[#1a1a1a]">
          {PDFViewer && InvoicePDFComp ? (
            <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: 0 }}>
              <InvoicePDFComp invoice={invoice} settings={settings} qrCodeDataURL={qrDataURL} />
            </PDFViewer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading preview…</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
