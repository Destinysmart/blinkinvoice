import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";

const ORANGE = "#F7931A";
const INK = "#0F0F10";
const TEXT = "#1f1f22";
const MUTED = "#8a8a90";
const SOFT = "#bdbdc4";
const HAIR = "#e6e6ea";
const PANEL = "#FAFAF7";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.45,
  },

  // ---------- Header ----------
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 36 },
  headerLeft: { flex: 1 },
  headerRight: { flex: 1, flexDirection: "row" },
  divider: { width: 1, backgroundColor: HAIR, marginRight: 18 },
  logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 10 },
  logoMark: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: ORANGE,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  logoMarkText: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 18 },

  // Label/value pairs (right column)
  metaRow: { flexDirection: "row", marginBottom: 10 },
  metaLabel: {
    width: 70, fontSize: 8, color: MUTED, textTransform: "uppercase",
    letterSpacing: 0.8, textAlign: "right", marginRight: 16, paddingTop: 2,
  },
  metaValue: { flex: 1, fontSize: 10, color: TEXT },
  bizName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 2 },
  bizLine: { fontSize: 10, color: TEXT },

  // ---------- INVOICE wordmark ----------
  wordmark: {
    fontSize: 36, fontFamily: "Helvetica-Bold", color: INK,
    letterSpacing: 1, marginTop: 8, marginBottom: 14,
  },

  // ---------- Bill-to + meta block ----------
  metaBlock: { flexDirection: "row", marginBottom: 36 },
  metaCol: { flex: 1, flexDirection: "row" },

  // ---------- Items ----------
  itemsHeader: {
    flexDirection: "row", backgroundColor: PANEL,
    paddingVertical: 9, paddingHorizontal: 10, marginBottom: 2,
  },
  th: {
    fontSize: 8, fontFamily: "Helvetica-Bold", color: INK,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  itemRow: {
    flexDirection: "row", paddingVertical: 11, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: HAIR,
  },
  td: { fontSize: 10, color: TEXT },
  colDesc: { flex: 3 },
  colNum: { flex: 1, textAlign: "right" },

  // ---------- Totals ----------
  totalsBox: { width: 260, alignSelf: "flex-end", marginTop: 20 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { color: MUTED, fontSize: 10 },
  totalValue: { fontSize: 10, color: TEXT },
  amountDueRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: HAIR,
  },
  amountDueLabel: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK },
  amountDueValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: INK },
  satsHint: { textAlign: "right", color: MUTED, fontSize: 9, marginTop: 4 },

  // ---------- Lightning ----------
  lightningCard: {
    marginTop: 32, padding: 18,
    borderWidth: 1, borderColor: HAIR, borderRadius: 4,
    backgroundColor: "#fffdfa",
  },
  lightningHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  lightningTitle: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: ORANGE,
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  lightningAmount: { fontSize: 14, fontFamily: "Courier-Bold", color: INK },
  lightningBody: { flexDirection: "row", gap: 18 },
  qrBox: {
    padding: 6, backgroundColor: "#fff",
    borderWidth: 1, borderColor: HAIR, borderRadius: 4,
  },
  qrImage: { width: 110, height: 110 },
  lightningInfo: { flex: 1, justifyContent: "center" },
  lightningInstructions: { fontSize: 9.5, color: TEXT, lineHeight: 1.55, marginBottom: 8 },
  walletList: { fontSize: 8.5, color: MUTED },
  bolt11Label: {
    marginTop: 14, fontSize: 7.5, color: MUTED,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  bolt11: {
    fontFamily: "Courier", fontSize: 7.5, color: "#3a3a3a",
    backgroundColor: "#f5f5f1", padding: 8, borderRadius: 3,
  },

  // ---------- Misc ----------
  notesBlock: { marginTop: 32 },
  notesLabel: {
    fontSize: 8, color: MUTED, textTransform: "uppercase",
    letterSpacing: 0.8, marginBottom: 6,
  },
  notesText: { fontSize: 10, color: TEXT, lineHeight: 1.5 },
  footerBar: {
    position: "absolute", bottom: 32, left: 56, right: 56,
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIR,
  },
  footerText: { fontSize: 8, color: SOFT },

  statusPill: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, fontSize: 8, fontFamily: "Helvetica-Bold",
    textTransform: "uppercase", letterSpacing: 0.8,
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  paid:    { bg: "#E9F7EF", color: "#1B7F47" },
  pending: { bg: "#FFF3E0", color: "#B26A00" },
  draft:   { bg: "#EFEFEF", color: "#555" },
};

function fmtMoney(n: number, currency: "USD" | "BTC") {
  if (currency === "USD") return `$${n.toFixed(2)}`;
  return `${Math.round(n).toLocaleString()} sats`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function InvoicePDF({
  invoice, settings, qrCodeDataURL,
}: { invoice: Invoice; settings: Settings; qrCodeDataURL?: string | null }) {
  const { subtotal, tax, total } = invoiceTotal(invoice);
  const status = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft;
  const businessInitial = (settings.businessName || "B").trim().charAt(0).toUpperCase();

  return (
    <Document title={invoice.number} author={settings.businessName || "BlinkInvoice"}>
      <Page size="A4" style={styles.page}>

        {/* Header: logo (left)  |  From (right, label/value with divider) */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {settings.logo ? (
              <Image src={settings.logo} style={styles.logo} />
            ) : (
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>{businessInitial}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.metaLabel}>From</Text>
            <View style={styles.divider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bizName}>{settings.businessName || "Your Business"}</Text>
              {settings.businessAddress
                ? settings.businessAddress.split("\n").map((line, i) => (
                    <Text key={i} style={styles.bizLine}>{line}</Text>
                  ))
                : null}
              {settings.businessEmail ? <Text style={styles.bizLine}>{settings.businessEmail}</Text> : null}
            </View>
          </View>
        </View>

        {/* INVOICE wordmark + meta */}
        <View style={styles.metaBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.wordmark}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice ID</Text>
              <Text style={styles.metaValue}>{invoice.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.issueDate ?? invoice.createdAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <View style={styles.metaValue}>
                <Text style={[styles.statusPill, { backgroundColor: status.bg, color: status.color }]}>
                  {invoice.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Bill To */}
          <View style={[styles.headerRight, { marginTop: 50 }]}>
            <Text style={styles.metaLabel}>Bill to</Text>
            <View style={styles.divider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bizName}>{invoice.client.name}</Text>
              {invoice.client.address
                ? invoice.client.address.split("\n").map((line, i) => (
                    <Text key={i} style={styles.bizLine}>{line}</Text>
                  ))
                : null}
              {invoice.client.email ? <Text style={styles.bizLine}>{invoice.client.email}</Text> : null}
            </View>
          </View>
        </View>

        {/* Items */}
        <View>
          <View style={styles.itemsHeader}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colNum]}>Unit Price</Text>
            <Text style={[styles.th, styles.colNum]}>Qty</Text>
            <Text style={[styles.th, styles.colNum]}>Amount</Text>
          </View>
          {invoice.items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={[styles.td, styles.colDesc]}>{it.desc || "—"}</Text>
              <Text style={[styles.td, styles.colNum]}>{fmtMoney(it.price, invoice.currency)}</Text>
              <Text style={[styles.td, styles.colNum]}>{it.qty}</Text>
              <Text style={[styles.td, styles.colNum]}>{fmtMoney(it.qty * it.price, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmtMoney(subtotal, invoice.currency)}</Text>
          </View>
          {invoice.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.tax}%)</Text>
              <Text style={styles.totalValue}>{fmtMoney(tax, invoice.currency)}</Text>
            </View>
          )}
          <View style={styles.amountDueRow}>
            <Text style={styles.amountDueLabel}>Amount Due</Text>
            <Text style={styles.amountDueValue}>{fmtMoney(total, invoice.currency)}</Text>
          </View>
          {invoice.satoshis && invoice.currency === "USD" ? (
            <Text style={styles.satsHint}>≈ {invoice.satoshis.toLocaleString()} sats</Text>
          ) : null}
        </View>

        {/* Lightning */}
        {invoice.paymentRequest ? (
          <View style={styles.lightningCard} wrap={false}>
            <View style={styles.lightningHead}>
              <Text style={styles.lightningTitle}>⚡  Pay via Bitcoin Lightning</Text>
              {invoice.satoshis ? (
                <Text style={styles.lightningAmount}>{invoice.satoshis.toLocaleString()} sats</Text>
              ) : null}
            </View>
            <View style={styles.lightningBody}>
              {qrCodeDataURL ? (
                <View style={styles.qrBox}>
                  <Image src={qrCodeDataURL} style={styles.qrImage} />
                </View>
              ) : null}
              <View style={styles.lightningInfo}>
                <Text style={styles.lightningInstructions}>
                  Open any Lightning wallet, choose Scan or Pay Invoice, and scan the QR code on the left.
                  Payment settles in seconds.
                </Text>
                <Text style={styles.walletList}>
                  Works with Blink, Zeus, Phoenix, Muun, Blue Wallet, Wallet of Satoshi and others.
                </Text>
              </View>
            </View>
            <Text style={styles.bolt11Label}>Lightning invoice (BOLT11)</Text>
            <Text style={styles.bolt11}>{invoice.paymentRequest}</Text>
          </View>
        ) : null}

        {/* Notes */}
        {invoice.memo ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.memo}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footerBar} fixed>
          <Text style={styles.footerText}>
            {settings.invoiceFooter || `Thank you for your business — ${settings.businessName || "BlinkInvoice"}`}
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadInvoicePDF(invoice: Invoice, settings: Settings) {
  const { pdf } = await import("@react-pdf/renderer");
  let qrCodeDataURL: string | null = null;
  if (invoice.paymentRequest) {
    qrCodeDataURL = await QRCode.toDataURL(`lightning:${invoice.paymentRequest}`, {
      width: 320,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  }
  const blob = await pdf(<InvoicePDF invoice={invoice} settings={settings} qrCodeDataURL={qrCodeDataURL} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
