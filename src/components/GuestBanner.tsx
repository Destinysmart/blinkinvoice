import { Link } from "@tanstack/react-router";
import { Laptop } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function GuestBanner() {
  const guest = useAppStore((s) => s.guest);
  if (!guest) return null;

  return (
    <div className="border-b border-border bg-primary/5 px-4 py-2 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-[12px] md:flex-wrap md:gap-x-3">
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-foreground">
          <Laptop className="h-3.5 w-3.5 text-primary" />
          Guest mode
        </span>
        <span className="hidden min-w-0 flex-1 text-muted-foreground md:inline">
          Invoices are saved on this device only — emailing and hosted pay links need an account.
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground md:hidden">
          Saved on this device only.
        </span>
        <Link
          to="/signup"
          className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground md:bg-transparent md:px-0 md:py-0 md:text-[12px] md:text-primary md:hover:underline"
        >
          Create a free account
        </Link>
      </div>
    </div>
  );
}
