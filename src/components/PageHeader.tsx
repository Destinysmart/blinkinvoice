import { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

/**
 * SaaS-style page header: title + subtitle on the left, actions on the right.
 * On mobile it stays compact — smaller title, hidden subtitle, full-width action row.
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
    <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-4 md:pb-6">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-display text-[17px] font-semibold tracking-tight md:text-[28px]">
            {title}
          </h1>
          {hint && <InfoHint text={hint} side="right" className="shrink-0" />}
        </div>
        {subtitle && (
          <p className="mt-1 hidden text-sm text-muted-foreground md:block">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full items-center gap-2 overflow-x-auto md:w-auto md:flex-nowrap md:overflow-visible [&>*]:flex-1 md:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
