import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Invoice, Settings } from "./types";

interface AppState {
  invoices: Invoice[];
  settings: Settings;
  seeded: boolean;
  addInvoice: (i: Invoice) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
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
};

function demoInvoices(): Invoice[] {
  const now = new Date();
  const d1 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
  const d2 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10);
  return [
    {
      id: crypto.randomUUID(),
      number: `INV-${d1.toISOString().slice(0,10).replace(/-/g,"")}-0001`,
      client: { name: "Nakamoto Studio", email: "hi@nakamoto.studio", address: "Tokyo, JP" },
      items: [{ id: crypto.randomUUID(), desc: "Brand identity design", qty: 1, price: 2400 }],
      currency: "USD", tax: 0, memo: "Phase 1 deliverable",
      status: "pending",
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
      paymentRequest: null, paymentHash: null, satoshis: null, expiresAt: null,
      createdAt: d2.toISOString(),
    },
  ];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      invoices: [],
      settings: defaultSettings,
      seeded: false,
      addInvoice: (i) => set({ invoices: [i, ...get().invoices] }),
      updateInvoice: (id, patch) =>
        set({ invoices: get().invoices.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      deleteInvoice: (id) =>
        set({ invoices: get().invoices.filter((x) => x.id !== id) }),
      saveSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      seedDemo: () => {
        if (get().seeded) return;
        set({ invoices: [...demoInvoices(), ...get().invoices], seeded: true });
      },
    }),
    { name: "blinkpay-store" }
  )
);

export function invoiceTotal(inv: { items: { qty: number; price: number }[]; tax: number }) {
  const subtotal = inv.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const tax = subtotal * ((Number(inv.tax) || 0) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function genInvoiceNumber(existing: string[]) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${today}-`;
  const nums = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
