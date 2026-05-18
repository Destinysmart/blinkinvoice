import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Client, Invoice, Settings } from "./types";

interface AppState {
  invoices: Invoice[];
  clients: Client[];
  settings: Settings;
  hydrated: boolean;
  hydrating: boolean;
  userId: string | null;

  addInvoice: (i: Invoice) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  saveSettings: (s: Partial<Settings>) => void;

  hydrate: (userId: string) => Promise<void>;
  reset: () => void;

  // Back-compat no-op (legacy demo seeder).
  seedDemo: () => void;
}

const defaultSettings: Settings = {
  businessName: "",
  businessEmail: "",
  businessAddress: "",
  apiKey: "",
  walletId: "",
  defaultCurrency: "USD",
  invoicePrefix: "INV",
  nextInvoiceNumber: 1,
  defaultPaymentTermsDays: 14,
  defaultTaxRate: 0,
  invoiceFooter: "Thank you for your business.",
  logo: "",
};

// ---------- Mappers (DB <-> in-memory) ----------

type DbProfile = Record<string, any>;

function profileToSettings(p: DbProfile | null): Settings {
  if (!p) return defaultSettings;
  return {
    businessName: p.business_name ?? "",
    businessEmail: p.business_email ?? "",
    businessAddress: p.address ?? "",
    apiKey: p.blink_api_key ?? "",
    walletId: p.btc_wallet_id ?? p.usd_wallet_id ?? "",
    defaultCurrency: (p.default_currency as Settings["defaultCurrency"]) ?? "USD",
    invoicePrefix: p.invoice_prefix ?? "INV",
    nextInvoiceNumber: p.next_invoice_number ?? 1,
    defaultPaymentTermsDays: p.default_payment_terms_days ?? 14,
    defaultTaxRate: Number(p.default_tax_rate ?? 0),
    invoiceFooter: p.invoice_footer ?? "",
    logo: p.logo_url ?? "",
  };
}

function settingsPatchToProfile(s: Partial<Settings>): DbProfile {
  const out: DbProfile = {};
  if (s.businessName !== undefined) out.business_name = s.businessName;
  if (s.businessEmail !== undefined) out.business_email = s.businessEmail;
  if (s.businessAddress !== undefined) out.address = s.businessAddress;
  if (s.apiKey !== undefined) out.blink_api_key = s.apiKey;
  if (s.walletId !== undefined) out.btc_wallet_id = s.walletId;
  if (s.defaultCurrency !== undefined) out.default_currency = s.defaultCurrency;
  if (s.invoicePrefix !== undefined) out.invoice_prefix = s.invoicePrefix;
  if (s.nextInvoiceNumber !== undefined) out.next_invoice_number = s.nextInvoiceNumber;
  if (s.defaultPaymentTermsDays !== undefined) out.default_payment_terms_days = s.defaultPaymentTermsDays;
  if (s.defaultTaxRate !== undefined) out.default_tax_rate = s.defaultTaxRate;
  if (s.invoiceFooter !== undefined) out.invoice_footer = s.invoiceFooter;
  if (s.logo !== undefined) out.logo_url = s.logo;
  return out;
}

function rowToClient(r: any): Client {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    address: r.address ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function rowToInvoice(r: any): Invoice {
  const snap = r.client_snapshot ?? {};
  return {
    id: r.id,
    number: r.number,
    client: {
      name: snap.name ?? "",
      email: snap.email ?? "",
      address: snap.address ?? "",
    },
    items: Array.isArray(r.items) ? r.items : [],
    currency: (r.currency as Invoice["currency"]) ?? "USD",
    tax: Number(r.tax ?? 0),
    memo: r.memo ?? "",
    status: (r.status as Invoice["status"]) ?? "draft",
    issueDate: r.issue_date ?? undefined,
    dueDate: r.due_date ?? undefined,
    paymentRequest: r.payment_request ?? null,
    paymentHash: r.payment_hash ?? null,
    satoshis: r.satoshis != null ? Number(r.satoshis) : null,
    expiresAt: r.expires_at != null ? Number(r.expires_at) : null,
    activity: Array.isArray(r.activity) ? r.activity : [],
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function invoiceToRow(inv: Invoice, userId: string) {
  return {
    id: inv.id,
    user_id: userId,
    number: inv.number,
    client_snapshot: inv.client,
    items: inv.items,
    currency: inv.currency,
    tax: inv.tax,
    memo: inv.memo,
    status: inv.status,
    issue_date: inv.issueDate ? inv.issueDate.slice(0, 10) : null,
    due_date: inv.dueDate ? inv.dueDate.slice(0, 10) : null,
    payment_request: inv.paymentRequest,
    payment_hash: inv.paymentHash,
    satoshis: inv.satoshis,
    expires_at: inv.expiresAt,
    activity: inv.activity ?? [],
    created_at: inv.createdAt,
  };
}

function invoicePatchToRow(patch: Partial<Invoice>) {
  const out: Record<string, any> = {};
  if (patch.number !== undefined) out.number = patch.number;
  if (patch.client !== undefined) out.client_snapshot = patch.client;
  if (patch.items !== undefined) out.items = patch.items;
  if (patch.currency !== undefined) out.currency = patch.currency;
  if (patch.tax !== undefined) out.tax = patch.tax;
  if (patch.memo !== undefined) out.memo = patch.memo;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.issueDate !== undefined) out.issue_date = patch.issueDate ? patch.issueDate.slice(0, 10) : null;
  if (patch.dueDate !== undefined) out.due_date = patch.dueDate ? patch.dueDate.slice(0, 10) : null;
  if (patch.paymentRequest !== undefined) out.payment_request = patch.paymentRequest;
  if (patch.paymentHash !== undefined) out.payment_hash = patch.paymentHash;
  if (patch.satoshis !== undefined) out.satoshis = patch.satoshis;
  if (patch.expiresAt !== undefined) out.expires_at = patch.expiresAt;
  if (patch.activity !== undefined) out.activity = patch.activity;
  return out;
}

// ---------- Store ----------

export const useAppStore = create<AppState>()((set, get) => ({
  invoices: [],
  clients: [],
  settings: defaultSettings,
  hydrated: false,
  hydrating: false,
  userId: null,

  addInvoice: (i) => {
    set({ invoices: [i, ...get().invoices] });
    const uid = get().userId;
    if (!uid) return;
    supabase.from("invoices").insert(invoiceToRow(i, uid)).then(({ error }) => {
      if (error) console.error("Failed to save invoice", error);
    });
  },

  updateInvoice: (id, patch) => {
    set({
      invoices: get().invoices.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
    const uid = get().userId;
    if (!uid) return;
    supabase.from("invoices").update(invoicePatchToRow(patch)).eq("id", id).then(({ error }) => {
      if (error) console.error("Failed to update invoice", error);
    });
  },

  deleteInvoice: (id) => {
    set({ invoices: get().invoices.filter((x) => x.id !== id) });
    supabase.from("invoices").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Failed to delete invoice", error);
    });
  },

  addClient: (c) => {
    set({ clients: [c, ...get().clients] });
    const uid = get().userId;
    if (!uid) return;
    supabase
      .from("clients")
      .insert({
        id: c.id,
        user_id: uid,
        name: c.name,
        email: c.email || null,
        address: c.address || null,
        created_at: c.createdAt,
      })
      .then(({ error }) => {
        if (error) console.error("Failed to save client", error);
      });
  },

  updateClient: (id, patch) => {
    set({
      clients: get().clients.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
    const out: Record<string, any> = {};
    if (patch.name !== undefined) out.name = patch.name;
    if (patch.email !== undefined) out.email = patch.email || null;
    if (patch.address !== undefined) out.address = patch.address || null;
    supabase.from("clients").update(out).eq("id", id).then(({ error }) => {
      if (error) console.error("Failed to update client", error);
    });
  },

  deleteClient: (id) => {
    set({ clients: get().clients.filter((x) => x.id !== id) });
    supabase.from("clients").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Failed to delete client", error);
    });
  },

  saveSettings: (s) => {
    set({ settings: { ...get().settings, ...s } });
    const uid = get().userId;
    if (!uid) return;
    const profilePatch = settingsPatchToProfile(s);
    if (Object.keys(profilePatch).length === 0) return;
    supabase
      .from("profiles")
      .update(profilePatch)
      .eq("id", uid)
      .then(({ error }) => {
        if (error) console.error("Failed to save settings", error);
      });
  },

  hydrate: async (userId) => {
    if (get().hydrating) return;
    set({ hydrating: true, userId });
    try {
      const [profileRes, clientsRes, invoicesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      ]);

      set({
        settings: profileToSettings(profileRes.data),
        clients: (clientsRes.data ?? []).map(rowToClient),
        invoices: (invoicesRes.data ?? []).map(rowToInvoice),
        hydrated: true,
        hydrating: false,
      });
    } catch (e) {
      console.error("Hydrate failed", e);
      set({ hydrating: false });
    }
  },

  reset: () =>
    set({
      invoices: [],
      clients: [],
      settings: defaultSettings,
      hydrated: false,
      hydrating: false,
      userId: null,
    }),

  seedDemo: () => {
    // legacy no-op; data now syncs from Supabase via hydrate()
  },
}));

// ---------- Helpers (unchanged exports) ----------

export function invoiceTotal(inv: { items: { qty: number; price: number }[]; tax: number }) {
  const subtotal = inv.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const tax = subtotal * ((Number(inv.tax) || 0) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function genInvoiceNumber(existing: string[], prefix = "INV", next?: number) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fullPrefix = `${prefix}-${today}-`;
  if (next && next > 0) return `${fullPrefix}${String(next).padStart(4, "0")}`;
  const nums = existing
    .filter((n) => n.startsWith(fullPrefix))
    .map((n) => parseInt(n.slice(fullPrefix.length), 10))
    .filter((n) => !isNaN(n));
  const nextN = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${fullPrefix}${String(nextN).padStart(4, "0")}`;
}
