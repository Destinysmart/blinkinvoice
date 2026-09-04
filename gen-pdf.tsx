import { renderToFile } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/InvoicePDF";
const inv: any = {
  id: "1", number: "INV-20260904-0001", status: "pending", currency: "USD",
  createdAt: new Date().toISOString(), issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now()+7*864e5).toISOString(), tax: 7.5,
  client: { name: "Acme Studios", email: "hi@acme.com", address: "12 Marina Road\nLagos, NG" },
  items: [
    { id: "a", desc: "Brand identity design", qty: 1, price: 1200 },
    { id: "b", desc: "Landing page build", qty: 2, price: 450 },
  ],
  memo: "Payment due within 7 days. Thanks!",
  paymentRequest: "lnbc1p" + "x".repeat(200),
  payToken: "abc123",
};
const settings: any = { businessName: "Bitlance", businessEmail: "billing@bitlance.work", businessAddress: "Remote", invoiceFooter: "" };
await renderToFile(<InvoicePDF invoice={inv} settings={settings} qrCodeDataURL={null} />, "/tmp/browser/pdf/out.pdf");
console.log("done");
