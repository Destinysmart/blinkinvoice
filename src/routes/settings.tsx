import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { Currency, Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { InstallAppCard } from "@/components/InstallAppCard";
import { WalletCard } from "@/components/WalletCard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const [form, setForm] = useState<Settings>(settings);

  // If settings hydrate from Supabase after this component mounted (or change
  // remotely via realtime), pull the new values into the form — but only while
  // the user hasn't started editing, so we never clobber in-flight edits.
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setForm(settings);
  }, [settings]);

  const update = (patch: Partial<Settings>) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = () => {
    saveSettings(form);
    dirtyRef.current = false;
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your business and Lightning wallet.</p>
      </div>

      <Card title="Business">
        <Field label="Business name"><Input value={form.businessName} onChange={(e) => update({ businessName: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.businessEmail} onChange={(e) => update({ businessEmail: e.target.value })} /></Field>
        <Field label="Address"><Textarea rows={2} value={form.businessAddress} onChange={(e) => update({ businessAddress: e.target.value })} /></Field>
      </Card>

      <WalletCard />

      <Card title="Invoice defaults">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Invoice prefix">
            <Input value={form.invoicePrefix ?? ""} placeholder="INV"
              onChange={(e) => update({ invoicePrefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Next invoice number">
            <Input type="number" min={1} value={form.nextInvoiceNumber ?? 1}
              onChange={(e) => update({ nextInvoiceNumber: Number(e.target.value) })} className="font-mono" />
          </Field>
          <Field label="Default payment terms">
            <select
              value={form.defaultPaymentTermsDays ?? 14}
              onChange={(e) => update({ defaultPaymentTermsDays: Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
            >
              {[7, 14, 30, 60].map((d) => <option key={d} value={d}>Net {d}</option>)}
            </select>
          </Field>
          <Field label="Default tax rate (%)">
            <Input type="number" min={0} value={form.defaultTaxRate ?? 0}
              onChange={(e) => update({ defaultTaxRate: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Invoice footer">
          <Textarea rows={2} value={form.invoiceFooter ?? ""}
            onChange={(e) => update({ invoiceFooter: e.target.value })} />
        </Field>
        <Field label="Business logo">
          <div className="flex items-center gap-4">
            {form.logo ? (
              <img src={form.logo} alt="logo" className="h-14 w-14 rounded-md border border-border object-contain bg-white p-1" />
            ) : (
              <div className="h-14 w-14 rounded-md border border-dashed border-border" />
            )}
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                Upload
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = () => update({ logo: String(r.result) });
                    r.readAsDataURL(f);
                  }} />
              </label>
              {form.logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update({ logo: "" })}>Remove</Button>
              )}
            </div>
          </div>
        </Field>
      </Card>

      <Card title="Preferences">
        <Field label="Default currency">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["USD", "BTC"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ defaultCurrency: c as Currency })}
                className={`rounded-sm px-4 py-1.5 text-sm font-medium transition ${
                  form.defaultCurrency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "BTC" ? "BTC (sats)" : "USD"}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Show advanced features</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Show Expenses, Projects and Reports in the sidebar. You can turn them back on anytime.
            </p>
          </div>
          <Switch
            checked={Boolean(form.showAdvanced)}
            onCheckedChange={(v) => update({ showAdvanced: v })}
          />
        </div>
      </Card>

      <Card title="Install">
        <InstallAppCard />
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Save changes</Button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
