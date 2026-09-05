import { renderToFile } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/InvoicePDF";
import React from "react";

const invoice: any = {
  id: "1",
  number: "INV-20260905-0001",
  currency: "USD",
  status: "pending",
  issueDate: "2026-09-05",
  dueDate: "2026-09-19",
  tax: 7.5,
  memo: "Thanks for working with us. Payment is due within 14 days.",
  client: { name: "Acme Studios", email: "hi@acme.com", address: "12 Marina Road\nLagos, Nigeria" },
  items: [
    { description: "Brand identity design", qty: 1, price: 1200 },
    { description: "Landing page build", qty: 2, price: 450 },
  ],
  paymentRequest: "lnbc12u1p3xyzpp5abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
  payToken: "abc123token",
};
const settings: any = { businessName: "Bitlance", email: "invoices@bitlance.work", invoiceFooter: "" };

await renderToFile(<InvoicePDF invoice={invoice} settings={settings} /> as any, "/tmp/browser/pdf/out.pdf");
console.log("done");
