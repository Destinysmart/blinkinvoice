import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/blinkinvoice-logo.png";

export function AuthShell({ children, title, subtitle, footer }: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoUrl} alt="BlinkInvoice" className="h-12 w-12 object-contain" />
            <span className="font-display text-2xl font-bold tracking-tight">BlinkInvoice</span>
          </Link>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Bitcoin Invoicing</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
