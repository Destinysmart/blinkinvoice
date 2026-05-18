import { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

/**
 * SaaS-style page header: title + subtitle on the left, actions on the right.
 * Sits at the top of every content page for a consistent, scannable layout.
 */
export function PageHeader({
  title,
  subtitle,
  hint,
  actions,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
            {title}
          </h1>
          {hint && <InfoHint text={hint} side="right" />}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
