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
  issueDate?: string;
  dueDate?: string;
  paymentRequest: string | null;
  paymentHash: string | null;
  satoshis: number | null;
  expiresAt: number | null;
  payToken?: string;
  activity?: { at: string; text: string }[];
  createdAt: string;
}

export interface Settings {
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  apiKey: string;
  walletId: string;
  defaultCurrency: Currency;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  defaultPaymentTermsDays?: number;
  defaultTaxRate?: number;
  invoiceFooter?: string;
  logo?: string; // base64 data URL
}

export interface Client {
  id: string;
  name: string;
  email: string;
  address: string;
  createdAt: string;
}
