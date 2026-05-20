import { CheckCircle2, AlertCircle, Mail, Ban } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type EmailDeliveryStatus = "queued" | "sent" | "failed" | "suppressed";

interface Props {
  status: EmailDeliveryStatus;
  recipient?: string;
  error?: string | null;
  compact?: boolean;
}

const META: Record<EmailDeliveryStatus, { label: string; cls: string; Icon: typeof Mail }> = {
  queued: { label: "Queued", cls: "bg-muted text-muted-foreground border-border", Icon: Mail },
  sent: { label: "Sent", cls: "bg-primary/10 text-primary border-primary/30", Icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: AlertCircle },
  suppressed: { label: "Suppressed", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: Ban },
};

export function EmailStatusBadge({ status, recipient, error, compact }: Props) {
  const { label, cls, Icon } = META[status];
  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {!compact && <span>{label}</span>}
    </span>
  );
  const tip = (
    <div className="max-w-xs space-y-1 text-xs">
      <div className="font-semibold">Email {label.toLowerCase()}</div>
      {recipient && <div className="text-muted-foreground break-all">{recipient}</div>}
      {error && <div className="text-destructive break-words">{error}</div>}
    </div>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
