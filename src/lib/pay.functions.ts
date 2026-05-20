import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLnBtcInvoice, fetchInvoiceStatus, usdCentsToSats } from "@/lib/blink";

const TokenInput = z.object({
  token: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  force: z.boolean().optional(),
});

function calcTotal(items: any[], taxPct: number) {
  const subtotal = (items ?? []).reduce(
    (s, it) => s + (Number(it?.qty) || 0) * (Number(it?.price) || 0),
    0,
  );
  const tax = subtotal * ((Number(taxPct) || 0) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

async function loadByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("id, user_id, number, client_snapshot, items, currency, tax, memo, status, issue_date, due_date, payment_request, payment_hash, satoshis, expires_at, paid_at, pay_token")
    .eq("pay_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invoice not found");
  return data as any;
}

async function loadOwnerProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("business_name, blink_api_key, btc_wallet_id, usd_wallet_id, logo_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as any;
}

function publicInvoice(row: any, profile: any) {
  const { total } = calcTotal(row.items ?? [], row.tax ?? 0);
  return {
    number: row.number as string,
    currency: row.currency as "USD" | "BTC",
    total,
    clientName: (row.client_snapshot?.name as string) ?? "",
    dueDate: row.due_date as string | null,
    status: row.status as "draft" | "pending" | "paid",
    memo: (row.memo as string) ?? "",
    paymentRequest: row.payment_request as string | null,
    satoshis: row.satoshis != null ? Number(row.satoshis) : null,
    expiresAt: normalizeExpiresAtMs(row.expires_at),
    paidAt: row.paid_at as string | null,
    businessName: (profile?.business_name as string) || "BlinkInvoice",
    logoUrl: (profile?.logo_url as string) || null,
  };
}

export const getPayInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const row = await loadByToken(data.token);
    const profile = await loadOwnerProfile(row.user_id);
    return publicInvoice(row, profile);
  });

export const refreshPayInvoice = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const row = await loadByToken(data.token);
    if (row.status === "paid") {
      const profile = await loadOwnerProfile(row.user_id);
      return publicInvoice(row, profile);
    }

    const nowMs = Date.now();
    const expiresSoon =
      !row.payment_request ||
      !row.expires_at ||
      Number(row.expires_at) - nowMs < 60 * 1000;

    if (!data.force && !expiresSoon) {
      const profile = await loadOwnerProfile(row.user_id);
      return publicInvoice(row, profile);
    }

    const profile = await loadOwnerProfile(row.user_id);
    const apiKey = profile?.blink_api_key as string | undefined;
    const walletId = (profile?.btc_wallet_id || profile?.usd_wallet_id) as string | undefined;
    if (!apiKey || !walletId) {
      throw new Error("Payment temporarily unavailable — the sender hasn't configured their wallet.");
    }

    const { total } = calcTotal(row.items ?? [], row.tax ?? 0);
    const memo = `${row.number} — ${row.client_snapshot?.name ?? ""}`.slice(0, 200);

    let sats: number;
    if (row.currency === "USD") {
      sats = await usdCentsToSats(apiKey, Math.round(total * 100));
    } else {
      sats = Math.round(total);
    }

    const ln = await createLnBtcInvoice(apiKey, walletId, sats, memo);
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1h default, milliseconds

    const { error: upErr } = await supabaseAdmin
      .from("invoices")
      .update({
        payment_request: ln.paymentRequest,
        payment_hash: ln.paymentHash,
        satoshis: ln.satoshis,
        expires_at: expiresAt,
      })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);

    return publicInvoice(
      { ...row, payment_request: ln.paymentRequest, payment_hash: ln.paymentHash, satoshis: ln.satoshis, expires_at: expiresAt },
      profile,
    );
  });

export const checkPayStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const row = await loadByToken(data.token);
    if (row.status === "paid") return { status: "paid" as const };
    if (!row.payment_request) return { status: "pending" as const };

    const profile = await loadOwnerProfile(row.user_id);
    const apiKey = profile?.blink_api_key as string | undefined;
    if (!apiKey) return { status: "pending" as const };

    try {
      const s = await fetchInvoiceStatus(apiKey, row.payment_request);
      if (s === "PAID") {
        const activity = Array.isArray(row.activity) ? row.activity : [];
        await supabaseAdmin
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            activity: [...activity, { at: new Date().toISOString(), text: "Payment received via Lightning" }],
          })
          .eq("id", row.id);
        return { status: "paid" as const };
      }
    } catch {
      // ignore transient
    }
    return { status: "pending" as const };
  });
