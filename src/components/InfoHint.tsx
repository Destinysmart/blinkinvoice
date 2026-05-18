import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Tiny "?" icon that explains what a thing does on hover.
 * Use next to labels, buttons, or column headers — keeps the UI clean
 * but makes every feature self-explanatory for first-time users.
 */
export function InfoHint({
  text,
  className = "",
  side = "top",
}: {
  text: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="More info"
            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition ${className}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[240px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Wraps any element with a tooltip — for icon-only buttons / nav items.
 */
export function HintWrap({
  hint,
  children,
  side = "top",
}: {
  hint: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-[240px] text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
