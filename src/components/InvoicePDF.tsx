import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";

const ORANGE = "#F7931A";
const MUTED = "#6b6b6b";
const BORDER = "#d4d4d4";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  bizName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED, fontSize: 9 },
  invoiceLabel: { fontSize: 28, fontFamily: "Helvetica-Bold", color: ORANGE, letterSpacing: 2, textAlign: "right" },
  invoiceNum: { fontFamily: "Courier-Bold", fontSize: 11, textAlign: "right", marginTop: 4 },
  smallLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  billTo: { marginBottom: 24 },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#f3f3f3", paddingVertical: 6, paddingHorizontal: 6, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold", color: "#444" },
  td: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 10 },
  colDesc: { flex: 3 },
  colNum: { flex: 1, textAlign: "right" },
  totalsBox: { width: 220, alignSelf: "flex-end", marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, fontSize: 10 },
  totalLine: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 6, paddingTop: 8 },
  totalAmount: { fontFamily: "Helvetica-Bold", fontSize: 16, color: ORANGE },
  section: { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ORANGE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  bolt11: { fontFamily: "Courier", fontSize: 8, color: "#333", backgroundColor: "#fafafa", padding: 8, borderWidth: 1, borderColor: BORDER },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  logo: { width: 48, height: 48, objectFit: "contain", marginBottom: 6 },
  lightningSection: { marginTop: 24, padding: 16, backgroundColor: "#FFF8F0", borderRadius: 6, borderLeftWidth: 4, borderLeftColor: ORANGE, borderLeftStyle: "solid" },
  lightningTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: ORANGE, letterSpacing: 1, marginBottom: 12 },
  lightningBody: { flexDirection: "row", alignItems: "center", gap: 20 },
  qrBox: { alignItems: "center", flexShrink: 0 },
  qrImage: { width: 110, height: 110 },
  qrCaption: { fontSize: 7, color: "#888888", textAlign: "center", marginTop: 4 },
  lightningInfo: { flex: 1 },
  lightningAmount: { fontSize: 16, fontFamily: "Courier-Bold", color: ORANGE, marginBottom: 8 },
  lightningInstructions: { fontSize: 9, color: "#444444", lineHeight: 1.5, marginBottom: 8 },
  walletList: { fontSize: 8, color: "#888888", fontStyle: "italic" },
});

function fmtMoney(n: number, currency: "USD" | "BTC") {
  if (currency === "USD") return `$${n.toFixed(2)}`;
  return `${Math.round(n).toLocaleString()} sats`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function InvoicePDF({ invoice, settings, qrCodeDataURL }: { invoice: Invoice; settings: Settings; qrCodeDataURL?: string | null }) {
  const { subtotal, tax, total } = invoiceTotal(invoice);

  return (
    <Document title={invoice.number} author={settings.businessName || "BlinkPay"}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {settings.logo ? <Image src={settings.logo} style={styles.logo} /> : null}
            <Text style={styles.bizName}>{settings.businessName || "Your Business"}</Text>
            {settings.businessEmail ? <Text style={styles.muted}>{settings.businessEmail}</Text> : null}
            {settings.businessAddress ? <Text style={styles.muted}>{settings.businessAddress}</Text> : null}
          </View>
          <View style={{ width: 200 }}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNum}>{invoice.number}</Text>
            <View style={{ marginTop: 10, alignItems: "flex-end" }}>
              <Text style={styles.muted}>Issued: {fmtDate(invoice.issueDate ?? invoice.createdAt)}</Text>
              <Text style={styles.muted}>Due: {fmtDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.smallLabel}>Bill to</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{invoice.client.name}</Text>
          {invoice.client.email ? <Text style={styles.muted}>{invoice.client.email}</Text> : null}
          {invoice.client.address ? <Text style={styles.muted}>{invoice.client.address}</Text> : null}
        </View>

        {/* Items */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <View style={styles.row}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colNum]}>Qty</Text>
            <Text style={[styles.th, styles.colNum]}>Unit Price</Text>
            <Text style={[styles.th, styles.colNum]}>Total</Text>
          </View>
          {invoice.items.map((it, i) => (
            <View key={it.id} style={[styles.row, { backgroundColor: i % 2 ? "#fafafa" : "#ffffff" }]}>
              <Text style={[styles.td, styles.colDesc]}>{it.desc || "—"}</Text>
              <Text style={[styles.td, styles.colNum]}>{it.qty}</Text>
              <Text style={[styles.td, styles.colNum]}>{fmtMoney(it.price, invoice.currency)}</Text>
              <Text style={[styles.td, styles.colNum]}>{fmtMoney(it.qty * it.price, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{fmtMoney(subtotal, invoice.currency)}</Text>
          </View>
          {invoice.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={{ color: MUTED }}>Tax ({invoice.tax}%)</Text>
              <Text>{fmtMoney(tax, invoice.currency)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalLine]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Total Due</Text>
            <Text style={styles.totalAmount}>{fmtMoney(total, invoice.currency)}</Text>
          </View>
          {invoice.satoshis ? (
            <Text style={{ textAlign: "right", color: MUTED, fontSize: 9, marginTop: 2 }}>
              ≈ {invoice.satoshis.toLocaleString()} sats
            </Text>
          ) : null}
        </View>

        {/* Lightning */}
        {invoice.paymentRequest ? (
          <View style={styles.lightningSection}>
            <Text style={styles.lightningTitle}>⚡  PAY VIA BITCOIN LIGHTNING</Text>
            <View style={styles.lightningBody}>
              {qrCodeDataURL ? (
                <View style={styles.qrBox}>
                  <Image src={qrCodeDataURL} style={styles.qrImage} />
                  <Text style={styles.qrCaption}>Scan to pay instantly</Text>
                </View>
              ) : null}
              <View style={styles.lightningInfo}>
                {invoice.satoshis ? (
                  <Text style={styles.lightningAmount}>{invoice.satoshis.toLocaleString()} sats</Text>
                ) : null}
                <Text style={styles.lightningInstructions}>
                  Open any Lightning wallet, tap Scan or Pay Invoice, then scan this QR code.
                </Text>
                <Text style={styles.walletList}>
                  Works with: Blink · Zeus · Phoenix · Muun · Blue Wallet · Wallet of Satoshi
                </Text>
              </View>
            </View>
            <Text style={[styles.bolt11, { marginTop: 10 }]}>{invoice.paymentRequest}</Text>
          </View>
        ) : null}

        {/* Memo */}
        {invoice.memo ? (
          <View style={styles.section}>
            <Text style={styles.smallLabel}>Notes</Text>
            <Text>{invoice.memo}</Text>
          </View>
        ) : null}

        {settings.invoiceFooter ? (
          <Text style={{ marginTop: 18, fontSize: 9, color: MUTED, textAlign: "center" }}>{settings.invoiceFooter}</Text>
        ) : null}

        <Text style={styles.footer} fixed>
          Generated by BlinkPay • Bitcoin-native invoicing
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePDFBlob(invoice: Invoice, settings: Settings): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  let qrCodeDataURL: string | null = null;
  if (invoice.paymentRequest) {
    qrCodeDataURL = await QRCode.toDataURL(`lightning:${invoice.paymentRequest}`, {
      width: 220,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  }
  return pdf(<InvoicePDF invoice={invoice} settings={settings} qrCodeDataURL={qrCodeDataURL} />).toBlob();
}

export async function downloadInvoicePDF(invoice: Invoice, settings: Settings) {
  const blob = await renderInvoicePDFBlob(invoice, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
