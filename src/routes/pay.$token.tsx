import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Zap, Copy, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPayInfo, refreshPayInvoice, checkPayStatus } from "@/lib/pay.functions";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: "Pay invoice" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PayPage,
});

function fmtAmount(currency: "USD" | "BTC", total: number) {
  return currency === "USD" ? `$${total.toFixed(2)}` : `${Math.round(total).toLocaleString()} sats`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PayPage() {
  const { token } = Route.useParams();
  const getInfo = useServerFn(getPayInfo);
  const refreshFn = useServerFn(refreshPayInvoice);
  const checkFn = useServerFn(checkPayStatus);

  const info = useQuery({
    queryKey: ["pay-info", token],
    queryFn: () => getInfo({ data: { token } }),
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: (vars: { force?: boolean } = {}) =>
      refreshFn({ data: { token, force: vars.force } }),
    onSuccess: (_data, vars) => {
      info.refetch();
      if (vars?.force) toast.success("New Lightning invoice generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-mint a BOLT11 on first load if invoice not paid and expiring soon
  const data = info.data;
  useEffect(() => {
    if (!data) return;
    if (data.status === "paid") return;
    const nowMs = Date.now();
    const soon = !data.paymentRequest || !data.expiresAt || data.expiresAt - nowMs < 60_000;
    if (soon && !refresh.isPending) refresh.mutate({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.paymentRequest, data?.expiresAt, data?.status]);

  // Poll for payment status every 3s while pending
  useEffect(() => {
    if (!data || data.status === "paid") return;
    const iv = setInterval(async () => {
      try {
        const r = await checkFn({ data: { token } });
        if (r.status === "paid") info.refetch();
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, [data?.status, token]);

  // Countdown (milliseconds)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-refresh ~30s before expiry
  useEffect(() => {
    if (!data || data.status === "paid" || !data.expiresAt) return;
    const remainingMs = data.expiresAt - nowMs;
    if (remainingMs < 30_000 && remainingMs > -5_000 && !refresh.isPending) {
      refresh.mutate({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, data?.expiresAt, data?.status]);

  if (info.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (info.error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Invoice not found</h1>
          <p className="text-sm text-muted-foreground">This payment link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const remainingMs = data.expiresAt ? Math.max(0, data.expiresAt - nowMs) : 0;
  const remainingSec = Math.floor(remainingMs / 1000);
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const lnUri = data.paymentRequest ? `lightning:${data.paymentRequest}` : "";

  const copyBolt11 = () => {
    if (!data.paymentRequest) return;
    navigator.clipboard.writeText(data.paymentRequest);
    toast.success("Invoice copied");
  };

  if (data.status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold mb-1">Payment received</h1>
          <p className="text-sm text-muted-foreground mb-6">Thank you. The sender has been notified.</p>
          <div className="rounded-lg bg-muted/40 border border-border p-4 text-left space-y-2 text-sm">
            <Row label="To" value={data.businessName} />
            <Row label="Invoice" value={data.number} />
            <Row label="Amount" value={fmtAmount(data.currency, data.total)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pay to</div>
          <div className="text-lg font-semibold mt-0.5">{data.businessName}</div>
          <div className="text-xs text-muted-foreground mt-1">Invoice {data.number} · for {data.clientName || "you"}</div>
        </div>

        {/* Amount */}
        <div className="px-6 py-6 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Amount due</div>
          <div className="text-3xl font-bold text-primary font-mono">{fmtAmount(data.currency, data.total)}</div>
          {data.dueDate && (
            <div className="text-xs text-muted-foreground mt-2">Due {fmtDate(data.dueDate)}</div>
          )}
        </div>

        {/* QR */}
        <div className="px-6 pb-4">
          {refresh.isPending && !data.paymentRequest ? (
            <div className="aspect-square bg-muted/40 rounded-xl grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.paymentRequest ? (
            <div className="bg-white rounded-xl p-4 grid place-items-center">
              <QRCodeSVG value={lnUri} size={240} level="M" />
            </div>
          ) : (
            <div className="aspect-square bg-muted/40 rounded-xl grid place-items-center text-sm text-muted-foreground">
              Unable to generate invoice
            </div>
          )}

          {data.paymentRequest && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Scan with any Lightning wallet
              </div>
              {data.expiresAt && remainingMs > 0 && (
                <div className="text-muted-foreground font-mono">
                  New QR in {mins}m {String(secs).padStart(2, "0")}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <Button onClick={copyBolt11} variant="outline" className="w-full" disabled={!data.paymentRequest}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy invoice
          </Button>
          <Button
            onClick={() => refresh.mutate()}
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            disabled={refresh.isPending}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>

        <div className="px-6 py-3 border-t border-border text-[10px] text-center text-muted-foreground uppercase tracking-wider">
          Powered by BlinkInvoice
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
