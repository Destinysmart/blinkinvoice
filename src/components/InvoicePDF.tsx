import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Invoice, Settings } from "@/lib/types";
import { invoiceTotal } from "@/lib/store";

// ---- Blink brand system ----
const ORANGE = "#FB5607";      // _primary2
const ORANGE_LIGHT = "#FFBE0B"; // _primary1
const INK = "#1D1D1D";         // dark ground (never pure black)
const TEXT = "#3A3C51";        // grey0
const MUTED = "#9292A0";       // grey2
const SOFT = "#AEAEB8";        // grey3
const HAIR = "#E2E2E4";        // grey4
const PANEL = "#F2F2F4";       // grey5
const RAISED = "#E7E7E7";      // grey6
const GREEN = "#00A700";

const FONT_CDN = "https://cdn.jsdelivr.net/fontsource/fonts";
Font.register({
  family: "IBMPlexSans",
  fonts: [
    { src: `${FONT_CDN}/ibm-plex-sans@latest/latin-400-normal.ttf`, fontWeight: 400 },
    { src: `${FONT_CDN}/ibm-plex-sans@latest/latin-500-normal.ttf`, fontWeight: 500 },
    { src: `${FONT_CDN}/ibm-plex-sans@latest/latin-600-normal.ttf`, fontWeight: 600 },
    { src: `${FONT_CDN}/ibm-plex-sans@latest/latin-700-normal.ttf`, fontWeight: 700 },
  ],
});
Font.register({
  family: "IBMPlexMono",
  fonts: [{ src: `${FONT_CDN}/ibm-plex-mono@latest/latin-400-normal.ttf`, fontWeight: 400 }],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    fontFamily: "IBMPlexSans",
    color: TEXT,
    lineHeight: 1.45,
  },

  // ---------- Dark Header ----------
  header: {
    backgroundColor: INK,
    paddingVertical: 18,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 38, height: 38, objectFit: "contain", marginRight: 12 },
  logoMark: {
    width: 38, height: 38, borderRadius: 8, backgroundColor: ORANGE,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  logoMarkText: { color: "#fff", fontFamily: "IBMPlexSans", fontWeight: 600, fontSize: 18 },
  bizNameHeader: { color: "#fff", fontFamily: "IBMPlexSans", fontWeight: 600, fontSize: 14 },
  bizTagHeader: { color: "#CCCCCC", fontSize: 9, marginTop: 1 },
  wordmark: {
    color: ORANGE, fontFamily: "IBMPlexSans", fontWeight: 600,
    fontSize: 20, letterSpacing: 2,
  },

  // Blink gradient strip (approximated with stepped bands: #FFBE0B -> #FB5607)
  gradientBar: { flexDirection: "row", height: 4, backgroundColor: ORANGE },
  gradientSeg: { flexGrow: 1, height: 4, marginRight: -1 },

  // ---------- Meta band ----------
  metaBand: {
    flexDirection: "row",
    backgroundColor: PANEL,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  metaCell: { flex: 1, alignItems: "center" },
  metaLabel: {
    fontSize: 7.5, color: MUTED, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 5,
  },
  metaValue: { fontSize: 11, fontFamily: "IBMPlexSans", fontWeight: 600, color: INK },
  statusPill: {
    paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: 999, fontSize: 9, fontFamily: "IBMPlexSans", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.8,
  },

  body: { paddingHorizontal: 40, paddingTop: 22 },

  // ---------- Parties ----------
  parties: { flexDirection: "row", marginBottom: 22 },
  partyCol: { flex: 1, paddingRight: 16 },
  partyLabel: {
    fontSize: 7.5, color: MUTED, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 6,
  },
  partyName: { fontSize: 12, fontFamily: "IBMPlexSans", fontWeight: 600, color: INK, marginBottom: 3 },
  partyLine: { fontSize: 9.5, color: TEXT, marginBottom: 1 },

  // ---------- Items ----------
  itemsHeader: {
    flexDirection: "row", backgroundColor: INK,
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 2, borderBottomColor: ORANGE_LIGHT,
  },
  th: {
    fontSize: 8.5, fontFamily: "IBMPlexSans", fontWeight: 600, color: "#fff",
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: "row", paddingVertical: 11, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: HAIR,
  },
  td: { fontSize: 10, color: TEXT },
  tdBold: { fontSize: 10, color: INK, fontFamily: "IBMPlexSans", fontWeight: 600 },
  colDesc: { flex: 3 },
  colNum: { flex: 1, textAlign: "right" },

  // ---------- Totals ----------
  totalsBox: { alignSelf: "flex-end", width: 260, marginTop: 10 },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 12,
  },
  totalLabel: { color: MUTED, fontSize: 10 },
  totalValue: { fontSize: 10, color: TEXT },
  amountDueRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 4, paddingTop: 8, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: HAIR,
  },
  amountDueLabel: { fontSize: 12, fontFamily: "IBMPlexSans", fontWeight: 600, color: INK },
  amountDueValue: { fontSize: 14, fontFamily: "IBMPlexSans", fontWeight: 600, color: ORANGE },

  // ---------- Lightning ----------
  lightningCard: {
    marginTop: 26,
    borderWidth: 1, borderColor: HAIR, borderRadius: 8,
    overflow: "hidden",
  },
  lightningHead: {
    backgroundColor: INK,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 14,
  },
  lightningHeadLeft: { flexDirection: "row", alignItems: "center" },
  lightningDot: {
    width: 10, height: 10, backgroundColor: ORANGE,
    marginRight: 8, borderRadius: 8,
  },
  lightningTitle: {
    fontSize: 10, fontFamily: "IBMPlexSans", fontWeight: 600, color: ORANGE,
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  lightningHint: { fontSize: 8.5, color: "#CCCCCC" },

  lightningBody: { flexDirection: "row", padding: 14, gap: 14 },
  qrBox: {
    padding: 6, backgroundColor: "#fff",
    borderWidth: 1, borderColor: HAIR, borderRadius: 8,
  },
  qrImage: { width: 110, height: 110 },
  lightningInfo: { flex: 1 },
  walletsLabel: {
    fontSize: 7.5, color: MUTED, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 4,
  },
  walletList: { fontSize: 9, color: TEXT, marginBottom: 10 },
  bolt11Label: {
    fontSize: 7.5, color: MUTED, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 4,
  },
  bolt11: {
    fontFamily: "IBMPlexMono", fontSize: 7.5, color: TEXT,
    backgroundColor: PANEL, padding: 6, borderRadius: 8,
    lineHeight: 1.4,
  },
  bolt11Hint: { fontSize: 8, color: MUTED, marginTop: 5 },

  // ---------- Notes ----------
  notesBlock: { marginTop: 18 },
  notesLabel: {
    fontSize: 7.5, color: MUTED, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 5,
  },
  notesText: { fontSize: 9.5, color: TEXT, lineHeight: 1.5 },

  // ---------- Footer ----------
  footerBar: {
    position: "absolute", bottom: 22, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIR,
  },
  footerText: { fontSize: 8, color: SOFT },
});

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  paid:    { bg: "#E6F6E6", color: GREEN },
  pending: { bg: "#FFF3D6", color: "#8A5A00" },
  draft:   { bg: RAISED, color: TEXT },
};

function fmtMoney(n: number, currency: "USD" | "BTC") {
  if (currency === "USD") return `$${n.toFixed(2)}`;
  return `${Math.round(n).toLocaleString()} sats`;
}
function fmtMoneyShort(n: number, currency: "USD" | "BTC") {
  if (currency === "USD") return `$${n.toFixed(2)}`;
  const v = Math.round(n);
  return `${v.toLocaleString()} ${v === 1 ? "sat" : "sats"}`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Break BOLT11 into wrappable chunks
function chunkBolt11(s: string, size = 64) {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.join("\n");
}

function getOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://blinkinvoice.lovable.app";
}

export function InvoicePDF({
  invoice, settings, qrCodeDataURL,
}: { invoice: Invoice; settings: Settings; qrCodeDataURL?: string | null }) {
  const { subtotal, tax, total } = invoiceTotal(invoice);
  const status = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft;
  const businessInitial = (settings.businessName || "B").trim().charAt(0).toUpperCase();
  const businessName = settings.businessName || "Your Business";

  return (
    <Document title={invoice.number} author={businessName}>
      <Page size="A4" style={styles.page}>

        {/* Dark Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {settings.logo ? (
              <Image src={settings.logo} style={styles.logo} />
            ) : (
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>{businessInitial}</Text>
              </View>
            )}
            <View>
              <Text style={styles.bizNameHeader}>{businessName}</Text>
              <Text style={styles.bizTagHeader}>Bitcoin Invoice</Text>
            </View>
          </View>
          <Text style={styles.wordmark}>INVOICE</Text>
        </View>

        {/* Blink gradient strip */}
        <View style={styles.gradientBar} fixed>
          {["#FFBE0B", "#FDA80A", "#FC9209", "#FC7C08", "#FB6607", ORANGE].map((c) => (
            <View key={c} style={[styles.gradientSeg, { backgroundColor: c }]} />
          ))}
        </View>

        {/* Meta band */}
        <View style={styles.metaBand}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Invoice ID</Text>
            <Text style={styles.metaValue}>{invoice.number}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>{fmtDate(invoice.issueDate ?? invoice.createdAt)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{fmtDate(invoice.dueDate)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.statusPill, { backgroundColor: status.bg, color: status.color }]}>
              {invoice.status}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Parties */}
          <View style={styles.parties}>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>From</Text>
              <Text style={styles.partyName}>{businessName}</Text>
              {settings.businessAddress
                ? settings.businessAddress.split("\n").map((line, i) => (
                    <Text key={i} style={styles.partyLine}>{line}</Text>
                  ))
                : null}
              {settings.businessEmail ? <Text style={styles.partyLine}>{settings.businessEmail}</Text> : null}
            </View>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>Bill To</Text>
              <Text style={styles.partyName}>{invoice.client.name}</Text>
              {invoice.client.address
                ? invoice.client.address.split("\n").map((line, i) => (
                    <Text key={i} style={styles.partyLine}>{line}</Text>
                  ))
                : null}
              {invoice.client.email ? <Text style={styles.partyLine}>{invoice.client.email}</Text> : null}
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
                <Text style={[styles.tdBold, styles.colDesc]}>{it.desc || "—"}</Text>
                <Text style={[styles.td, styles.colNum]}>{fmtMoneyShort(it.price, invoice.currency)}</Text>
                <Text style={[styles.td, styles.colNum]}>{it.qty}</Text>
                <Text style={[styles.tdBold, styles.colNum]}>{fmtMoneyShort(it.qty * it.price, invoice.currency)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{fmtMoneyShort(subtotal, invoice.currency)}</Text>
            </View>
            {invoice.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({invoice.tax}%)</Text>
                <Text style={styles.totalValue}>{fmtMoneyShort(tax, invoice.currency)}</Text>
              </View>
            )}
            <View style={styles.amountDueRow}>
              <Text style={styles.amountDueLabel}>Amount Due</Text>
              <Text style={styles.amountDueValue}>{fmtMoneyShort(total, invoice.currency)}</Text>
            </View>
          </View>

          {/* Lightning */}
          {invoice.paymentRequest ? (
            <View style={styles.lightningCard} wrap={false}>
              <View style={styles.lightningHead}>
                <View style={styles.lightningHeadLeft}>
                  <View style={styles.lightningDot} />
                  <Text style={styles.lightningTitle}>Pay via Bitcoin Lightning</Text>
                </View>
                <Text style={styles.lightningHint}>Scan with any Lightning wallet to pay instantly</Text>
              </View>
              <View style={styles.lightningBody}>
                {qrCodeDataURL ? (
                  <View style={styles.qrBox}>
                    <Image src={qrCodeDataURL} style={styles.qrImage} />
                  </View>
                ) : null}
                <View style={styles.lightningInfo}>
                  <Text style={styles.walletsLabel}>Works with</Text>
                  <Text style={styles.walletList}>Any Lightning wallet</Text>
                  <Text style={styles.bolt11Label}>Lightning Invoice (BOLT11)</Text>
                  <Text style={styles.bolt11}>{chunkBolt11(invoice.paymentRequest)}</Text>
                  <Text style={styles.bolt11Hint}>
                    Copy and paste into any Lightning wallet.{invoice.payToken ? `  QR expired? Pay online: ${getOrigin()}/pay/${invoice.payToken}` : ""}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Notes */}
          {invoice.memo ? (
            <View style={styles.notesBlock}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{invoice.memo}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footerBar} fixed>
          <Text style={styles.footerText}>Payment powered by Blink Bitcoin Wallet · blink.sv</Text>
          <Text style={styles.footerText}>
            {settings.invoiceFooter || `Thank you for your business, ${businessName}.`}
          </Text>
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
