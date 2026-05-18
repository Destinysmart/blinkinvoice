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
