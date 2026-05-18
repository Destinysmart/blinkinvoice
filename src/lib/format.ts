export function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function fmtSats(n: number) {
  return `${Math.round(n).toLocaleString()} sats`;
}

export function fmtDate(d: string | Date | undefined | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function fmtMoney(n: number, currency: "USD" | "BTC") {
  return currency === "USD" ? fmtUsd(n) : fmtSats(n);
}

export function isOverdue(inv: { dueDate?: string; status: string }) {
  if (!inv.dueDate || inv.status === "paid" || inv.status === "draft") return false;
  return new Date(inv.dueDate).getTime() < Date.now();
}
