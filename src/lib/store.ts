import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Client, Invoice, Settings } from "./types";

let realtimeChannel: RealtimeChannel | null = null;

interface AppState {
  invoices: Invoice[];
  clients: Client[];
  settings: Settings;
  hydrated: boolean;
  hydrating: boolean;
  userId: string | null;
  guest: boolean;


  addInvoice: (i: Invoice) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  saveSettings: (s: Partial<Settings>) => void;

  hydrate: (userId: string) => Promise<void>;
  enterGuest: () => void;
  exitGuest: () => void;
  reset: () => void;

  // Back-compat no-op (legacy demo seeder).
  seedDemo: () => void;
}

const defaultSettings: Settings = {
  businessName: "",
  businessEmail: "",
  businessAddress: "",
  defaultCurrency: "USD",
  invoicePrefix: "INV",
  nextInvoiceNumber: 1,
  defaultPaymentTermsDays: 14,
  defaultTaxRate: 0,
  invoiceFooter: "Thank you for your business.",
  logo: "",
  showAdvanced: false,
};

// ---------- Mappers (DB <-> in-memory) ----------

type DbProfile = Record<string, any>;

function profileToSettings(p: DbProfile | null): Settings {
  if (!p) return defaultSettings;
  return {
    businessName: p.business_name ?? "",
    businessEmail: p.business_email ?? "",
    businessAddress: p.address ?? "",
    defaultCurrency: (p.default_currency as Settings["defaultCurrency"]) ?? "USD",
    invoicePrefix: p.invoice_prefix ?? "INV",
    nextInvoiceNumber: p.next_invoice_number ?? 1,
    defaultPaymentTermsDays: p.default_payment_terms_days ?? 14,
    defaultTaxRate: Number(p.default_tax_rate ?? 0),
    invoiceFooter: p.invoice_footer ?? "",
    logo: p.logo_url ?? "",
    showAdvanced: Boolean(p.show_advanced),
  };
}

function settingsPatchToProfile(s: Partial<Settings>): DbProfile {
  const out: DbProfile = {};
  if (s.businessName !== undefined) out.business_name = s.businessName;
  if (s.businessEmail !== undefined) out.business_email = s.businessEmail;
  if (s.businessAddress !== undefined) out.address = s.businessAddress;
  if (s.defaultCurrency !== undefined) out.default_currency = s.defaultCurrency;
  if (s.invoicePrefix !== undefined) out.invoice_prefix = s.invoicePrefix;
  if (s.nextInvoiceNumber !== undefined) out.next_invoice_number = s.nextInvoiceNumber;
  if (s.defaultPaymentTermsDays !== undefined) out.default_payment_terms_days = s.defaultPaymentTermsDays;
  if (s.defaultTaxRate !== undefined) out.default_tax_rate = s.defaultTaxRate;
  if (s.invoiceFooter !== undefined) out.invoice_footer = s.invoiceFooter;
  if (s.logo !== undefined) out.logo_url = s.logo;
  if (s.showAdvanced !== undefined) out.show_advanced = s.showAdvanced;
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
    verifyUrl: r.verify_url ?? null,
    lnAddress: r.ln_address ?? null,
    payToken: r.pay_token ?? undefined,
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
    verify_url: inv.verifyUrl ?? null,
    ln_address: inv.lnAddress ?? null,
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
  if (patch.verifyUrl !== undefined) out.verify_url = patch.verifyUrl;
  if (patch.lnAddress !== undefined) out.ln_address = patch.lnAddress;
  if (patch.activity !== undefined) out.activity = patch.activity;
  return out;
}

// ---------- Guest (local-only, no account) ----------

export const GUEST_FLAG_KEY = "bi.guest";
const GUEST_DATA_KEY = "bi.guest.data";

export function isGuestSession() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUEST_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function readGuestData(): { invoices: Invoice[]; clients: Client[]; settings: Settings } {
  if (typeof window === "undefined") return { invoices: [], clients: [], settings: defaultSettings };
  try {
    const raw = window.localStorage.getItem(GUEST_DATA_KEY);
    if (!raw) return { invoices: [], clients: [], settings: defaultSettings };
    const parsed = JSON.parse(raw);
    return {
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { invoices: [], clients: [], settings: defaultSettings };
  }
}

function writeGuestData(state: { invoices: Invoice[]; clients: Client[]; settings: Settings }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_DATA_KEY,
      JSON.stringify({ invoices: state.invoices, clients: state.clients, settings: state.settings }),
    );
  } catch {
    /* quota / private mode — ignore */
  }
}

// ---------- Store ----------

export const useAppStore = create<AppState>()((set, get) => ({
  invoices: [],
  clients: [],
  settings: defaultSettings,
  hydrated: false,
  hydrating: false,
  userId: null,
  guest: false,


  addInvoice: (i) => {
    set({ invoices: [i, ...get().invoices] });
    const uid = get().userId;
    if (!uid) return;
    (supabase.from("invoices") as any).insert(invoiceToRow(i, uid)).then(({ error }: any) => {
      if (error) console.error("Failed to save invoice", error);
    });
  },

  updateInvoice: (id, patch) => {
    set({
      invoices: get().invoices.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
    const uid = get().userId;
    if (!uid) return;
    (supabase.from("invoices") as any).update(invoicePatchToRow(patch)).eq("id", id).then(({ error }: any) => {
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
    (supabase.from("clients") as any).update(out).eq("id", id).then(({ error }: any) => {
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
    (supabase
      .from("profiles") as any)
      .update(profilePatch)
      .eq("id", uid)
      .then(({ error }: any) => {
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

      subscribeRealtime(userId);
    } catch (e) {
      console.error("Hydrate failed", e);
      set({ hydrating: false });
    }
  },

  reset: () => {
    unsubscribeRealtime();
    set({
      invoices: [],
      clients: [],
      settings: defaultSettings,
      hydrated: false,
      hydrating: false,
      userId: null,
    });
  },

  seedDemo: () => {
    // legacy no-op; data now syncs from Supabase via hydrate()
  },
}));

// ---------- Realtime sync ----------

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function subscribeRealtime(userId: string) {
  unsubscribeRealtime();
  const store = useAppStore;

  realtimeChannel = supabase
    .channel(`user-sync-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${userId}` },
      (payload) => {
        const state = store.getState();
        if (payload.eventType === "DELETE") {
          const id = (payload.old as any)?.id;
          if (id) store.setState({ invoices: state.invoices.filter((x) => x.id !== id) });
          return;
        }
        const inv = rowToInvoice(payload.new);
        const existing = state.invoices.find((x) => x.id === inv.id);
        store.setState({
          invoices: existing
            ? state.invoices.map((x) => (x.id === inv.id ? inv : x))
            : [inv, ...state.invoices],
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clients", filter: `user_id=eq.${userId}` },
      (payload) => {
        const state = store.getState();
        if (payload.eventType === "DELETE") {
          const id = (payload.old as any)?.id;
          if (id) store.setState({ clients: state.clients.filter((x) => x.id !== id) });
          return;
        }
        const c = rowToClient(payload.new);
        const existing = state.clients.find((x) => x.id === c.id);
        store.setState({
          clients: existing
            ? state.clients.map((x) => (x.id === c.id ? c : x))
            : [c, ...state.clients],
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") return;
        store.setState({ settings: profileToSettings(payload.new) });
      },
    )
    .subscribe();
}

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
