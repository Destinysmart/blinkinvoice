export type Currency = "USD" | "BTC";
export type InvoiceStatus = "draft" | "pending" | "paid";

export interface LineItem {
  id: string;
  desc: string;
  qty: number;
  price: number;
}

export interface Invoice {
  id: string;
  number: string;
  client: { name: string; email: string; address: string };
  items: LineItem[];
  currency: Currency;
  tax: number;
  memo: string;
  status: InvoiceStatus;
  paymentRequest: string | null;
  paymentHash: string | null;
  satoshis: number | null;
  expiresAt: number | null;
  createdAt: string;
}

export interface Settings {
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  apiKey: string;
  walletId: string;
  defaultCurrency: Currency;
}
