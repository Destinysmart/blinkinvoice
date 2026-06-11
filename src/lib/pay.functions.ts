import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

function normalizeExpiresAtMs(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  return n < 1e11 ? n * 1000 : n;
}

async function loadByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("id, user_id, number, client_snapshot, items, currency, tax, memo, status, issue_date, due_date, payment_request, payment_hash, satoshis, expires_at, verify_url, paid_at, pay_token, activity, ln_address")
    .eq("pay_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invoice not found");
  return data as any;
}

async function loadOwnerProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("business_name, logo_url")
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
    paymentHash: row.payment_hash as string | null,
    satoshis: row.satoshis != null ? Number(row.satoshis) : null,
    expiresAt: normalizeExpiresAtMs(row.expires_at),
    verifyUrl: (row.verify_url as string | null) ?? null,
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

// Mint a fresh BOLT11 via the merchant's lightning address (LNURL-pay).
// This runs server-side so the customer can keep paying even after the
// originally-pre-generated invoice has expired and the merchant's wallet
// is offline.
function normalizeAddress(a: string) {
  const t = a.trim().toLowerCase();
  return t.includes("@") ? t : `${t}@blink.sv`;
}
function paymentHashFromBolt11(bolt11: string) {
  const i = bolt11.toLowerCase().indexOf("p");
  return i > 0 && bolt11.length > i + 54 ? bolt11.slice(i + 2, i + 54) : bolt11.slice(0, 64);
}
async function usdToSats(usd: number) {
  const r = await fetch("https://blockchain.info/tobtc?currency=USD&value=1");
  const rate = parseFloat(await r.text());
  if (!isFinite(rate) || rate <= 0) throw new Error("Unable to fetch BTC rate");
  return Math.round(usd * rate * 1e8);
}
async function mintViaLnAddress(args: {
  address: string;
  currency: "USD" | "BTC";
  total: number;
  memo: string;
}) {
  const addr = normalizeAddress(args.address);
  const [user, domain] = addr.split("@");
  const lnurlpRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!lnurlpRes.ok) throw new Error(`Lightning address not found: ${addr}`);
  const lnurlp: any = await lnurlpRes.json();
  if (lnurlp.tag !== "payRequest" || !lnurlp.callback) {
    throw new Error("Invalid LNURL-pay response");
  }
  const sats = args.currency === "USD" ? await usdToSats(args.total) : Math.round(args.total);
  const msats = sats * 1000;
  const cb = new URL(lnurlp.callback);
  cb.searchParams.set("amount", String(msats));
  if (args.memo) cb.searchParams.set("comment", args.memo.slice(0, 200));
  const cbRes = await fetch(cb.toString());
  if (!cbRes.ok) throw new Error("Failed to fetch invoice from LNURL callback");
  const cbJson: any = await cbRes.json();
  if (!cbJson.pr) throw new Error("LNURL callback did not return a bolt11");
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    bolt11: cbJson.pr as string,
    paymentHash: paymentHashFromBolt11(cbJson.pr),
    sats,
    expiresAtMs: (nowSec + 3600) * 1000,
    verify: (cbJson.verify as string | undefined) ?? null,
  };
}

export const refreshPayInvoice = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    let row = await loadByToken(data.token);
    const profile = await loadOwnerProfile(row.user_id);

    if (row.status === "paid") return publicInvoice(row, profile);

    const expiresMs = normalizeExpiresAtMs(row.expires_at);
    const isExpired = !row.payment_request || !expiresMs || expiresMs - Date.now() < 60_000;
    const shouldMint = data.force || isExpired;

    if (shouldMint && row.ln_address) {
      const { total } = calcTotal(row.items ?? [], row.tax ?? 0);
      if (total > 0) {
        try {
          const minted = await mintViaLnAddress({
            address: row.ln_address,
            currency: row.currency,
            total,
            memo: (row.memo as string) || `${row.number} — ${row.client_snapshot?.name ?? ""}`,
          });
          const { data: updated, error } = await supabaseAdmin
            .from("invoices")
            .update({
              payment_request: minted.bolt11,
              payment_hash: minted.paymentHash,
              satoshis: minted.sats,
              expires_at: minted.expiresAtMs,
              verify_url: minted.verify,
            })
            .eq("id", row.id)
            .select("id, user_id, number, client_snapshot, items, currency, tax, memo, status, issue_date, due_date, payment_request, payment_hash, satoshis, expires_at, verify_url, paid_at, pay_token, activity, ln_address")
            .single();
          if (!error && updated) row = updated as any;
        } catch (e) {
          console.error("Failed to mint LNURL invoice", e);
        }
      }
    }

    return publicInvoice(row, profile);
  });

// Status check: if a verify URL is stored (LNURL/Lightning Address),
// poll it directly. Otherwise just return the current DB status.
export const checkPayStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const row = await loadByToken(data.token);
    if (row.status === "paid") return { status: "paid" as const };
    const verifyUrl = row.verify_url as string | undefined;
    if (!verifyUrl) return { status: "pending" as const };

    try {
      const res = await fetch(verifyUrl);
      if (!res.ok) return { status: "pending" as const };
      const j: any = await res.json();
      const settled = j?.settled === true || j?.status === "OK" && j?.settled !== false;
      if (settled) {
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
