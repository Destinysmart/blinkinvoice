import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { fetchMe, type MeWallet } from "@/lib/blink";
import type { Currency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { InstallAppCard } from "@/components/InstallAppCard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const [form, setForm] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [wallets, setWallets] = useState<MeWallet[] | null>(null);

  const test = useMutation({
    mutationFn: () => {
      if (!form.apiKey) throw new Error("Enter an API key first");
      return fetchMe(form.apiKey);
    },
    onSuccess: (w) => { setWallets(w); toast.success("Connection successful"); },
    onError: (e: Error) => { setWallets(null); toast.error(e.message); },
  });

  const save = () => { saveSettings(form); toast.success("Settings saved"); };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your business and Blink connection.</p>
      </div>

      <Card title="Business">
        <Field label="Business name"><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} /></Field>
        <Field label="Address"><Textarea rows={2} value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} /></Field>
      </Card>

      <Card title="Blink Lightning">
        <Field label="API key">
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="blink_..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="font-mono"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
        <Field label="Wallet ID"><Input value={form.walletId} onChange={(e) => setForm({ ...form, walletId: e.target.value })} className="font-mono" /></Field>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          {wallets && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Connected
            </div>
          )}
        </div>

        {wallets && (
          <div className="rounded-md border border-border bg-[var(--surface)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallets</p>
            <div className="space-y-1.5">
              {wallets.map((w) => (
                <div key={w.id} className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">{w.walletCurrency}</span>
                  <span className="font-bold text-primary">
                    {w.balance.toLocaleString()} {w.walletCurrency === "BTC" ? "sats" : "¢"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs" style={{ color: "var(--warning)" }}>
          <strong>Production note:</strong> Browser-side API key usage is for demo only. In production, proxy these calls through a backend to keep your key private.
        </div>
      </Card>

      <Card title="Invoice defaults">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Invoice prefix">
            <Input value={form.invoicePrefix ?? ""} placeholder="INV"
              onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Next invoice number">
            <Input type="number" min={1} value={form.nextInvoiceNumber ?? 1}
              onChange={(e) => setForm({ ...form, nextInvoiceNumber: Number(e.target.value) })} className="font-mono" />
          </Field>
          <Field label="Default payment terms">
            <select
              value={form.defaultPaymentTermsDays ?? 14}
              onChange={(e) => setForm({ ...form, defaultPaymentTermsDays: Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {[7, 14, 30, 60].map((d) => <option key={d} value={d}>Net {d}</option>)}
            </select>
          </Field>
          <Field label="Default tax rate (%)">
            <Input type="number" min={0} value={form.defaultTaxRate ?? 0}
              onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Invoice footer">
          <Textarea rows={2} value={form.invoiceFooter ?? ""}
            onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })} />
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
                    r.onload = () => setForm({ ...form, logo: String(r.result) });
                    r.readAsDataURL(f);
                  }} />
              </label>
              {form.logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo: "" })}>Remove</Button>
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
                onClick={() => setForm({ ...form, defaultCurrency: c as Currency })}
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
            onCheckedChange={(v) => setForm({ ...form, showAdvanced: v })}
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
