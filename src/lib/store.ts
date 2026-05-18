import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Client, Invoice, Settings } from "./types";

interface AppState {
  invoices: Invoice[];
  clients: Client[];
  settings: Settings;
  seeded: boolean;
  addInvoice: (i: Invoice) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  saveSettings: (s: Partial<Settings>) => void;
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

function addDays(d: Date, days: number) {
  const c = new Date(d); c.setDate(c.getDate() + days); return c;
}

function demoInvoices(): Invoice[] {
  const now = new Date();
  const d1 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
  const d2 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10);
  const d3 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 35);
  return [
    {
      id: crypto.randomUUID(),
      number: `INV-${d1.toISOString().slice(0,10).replace(/-/g,"")}-0001`,
      client: { name: "Nakamoto Studio", email: "hi@nakamoto.studio", address: "Tokyo, JP" },
      items: [{ id: crypto.randomUUID(), desc: "Brand identity design", qty: 1, price: 2400 }],
      currency: "USD", tax: 0, memo: "Phase 1 deliverable",
      status: "pending",
      issueDate: d1.toISOString(),
      dueDate: addDays(d1, 14).toISOString(),
      paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null,
      createdAt: d1.toISOString(),
    },
    {
      id: crypto.randomUUID(),
      number: `INV-${d2.toISOString().slice(0,10).replace(/-/g,"")}-0002`,
      client: { name: "Orange Pill Co.", email: "ops@orangepill.co", address: "Lisbon, PT" },
      items: [
        { id: crypto.randomUUID(), desc: "Consulting", qty: 8, price: 150 },
        { id: crypto.randomUUID(), desc: "Workshop facilitation", qty: 1, price: 800 },
      ],
      currency: "USD", tax: 10, memo: "Q1 engagement",
      status: "paid",
      issueDate: d2.toISOString(),
      dueDate: addDays(d2, 14).toISOString(),
      paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null,
      createdAt: d2.toISOString(),
    },
    {
      id: crypto.randomUUID(),
      number: `INV-${d3.toISOString().slice(0,10).replace(/-/g,"")}-0003`,
      client: { name: "Mempool Labs", email: "billing@mempool.io", address: "Berlin, DE" },
      items: [{ id: crypto.randomUUID(), desc: "Monthly retainer — March", qty: 1, price: 1800 }],
      currency: "USD", tax: 0, memo: "",
      status: "pending",
      issueDate: d3.toISOString(),
      dueDate: addDays(d3, 14).toISOString(),
      paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null,
      createdAt: d3.toISOString(),
    },
  ];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      invoices: [],
      clients: [],
      settings: defaultSettings,
      seeded: false,
      addInvoice: (i) => set({ invoices: [i, ...get().invoices] }),
      updateInvoice: (id, patch) =>
        set({ invoices: get().invoices.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      deleteInvoice: (id) =>
        set({ invoices: get().invoices.filter((x) => x.id !== id) }),
      addClient: (c) => set({ clients: [c, ...get().clients] }),
      updateClient: (id, patch) =>
        set({ clients: get().clients.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      deleteClient: (id) =>
        set({ clients: get().clients.filter((x) => x.id !== id) }),
      saveSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      seedDemo: () => {
        // Demo seeding disabled. Purge any previously seeded demo invoices
        // so existing users don't keep seeing fake clients (Nakamoto Studio,
        // Orange Pill Co., Mempool Labs).
        const demoNames = new Set(["Nakamoto Studio", "Orange Pill Co.", "Mempool Labs"]);
        const cleaned = get().invoices.filter((i) => !demoNames.has(i.client?.name ?? ""));
        if (cleaned.length !== get().invoices.length || !get().seeded) {
          set({ invoices: cleaned, seeded: true });
        }
      },
    }),
    {
      name: "blinkpay-store",
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted ?? {}),
        clients: persisted?.clients ?? [],
        settings: { ...defaultSettings, ...(persisted?.settings ?? {}) },
      }),
    }
  )
);

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
