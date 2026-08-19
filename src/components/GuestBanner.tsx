import { Link } from "@tanstack/react-router";
import { Laptop } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function GuestBanner() {
  const guest = useAppStore((s) => s.guest);
  if (!guest) return null;

  return (
    <div className="border-b border-border bg-primary/5 px-4 py-2 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Laptop className="h-3.5 w-3.5 text-primary" />
          Guest mode
        </span>
        <span className="text-muted-foreground">
          Invoices are saved on this device only — emailing and hosted pay links need an account.
        </span>
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create a free account
        </Link>
      </div>
    </div>
  );
}
