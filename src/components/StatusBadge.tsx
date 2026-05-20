import type { InvoiceStatus } from "@/lib/types";

type Status = InvoiceStatus | "overdue" | "sent";

const styles: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-muted text-foreground/70 border-border",
  sent: "bg-muted text-foreground/70 border-border",
  paid: "bg-success/15 text-success border-success/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
