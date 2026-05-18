import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, CheckCircle2, XCircle } from "lucide-react";
import { listInvoiceEmails } from "@/lib/email.functions";

interface Props {
  invoiceId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function EmailHistory({ invoiceId }: Props) {
  const isUuid = UUID_RE.test(invoiceId);
  const fn = useServerFn(listInvoiceEmails);
  const { data, isLoading } = useQuery({
    queryKey: ["email-logs", invoiceId],
    queryFn: () => fn({ data: { invoiceId } }),
    enabled: isUuid,
  });

  if (!isUuid) return null;

  const logs = data?.logs ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Email history</h3>
        <span className="text-xs text-muted-foreground">({logs.length})</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No emails sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((l: any) => (
            <li key={l.id} className="flex items-start gap-2 rounded-md border border-border/60 p-2 text-xs">
              {l.status === "sent" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{l.recipient_email}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                </div>
                {l.subject && <div className="truncate text-muted-foreground">{l.subject}</div>}
                {l.error && <div className="mt-1 text-red-400">{l.error}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
