import type { InvoiceStatus } from "@/lib/types";

const styles: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-success/15 text-success border-success/30",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${styles[status]}`}
      style={status === "success" ? { color: "var(--success)" } : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
