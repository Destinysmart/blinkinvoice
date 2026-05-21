import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LightningConnect, useWalletConnect } from "lightningconnect";
import { CheckCircle2, Zap, LogOut } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Currency, Settings } from "@/lib/types";
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
  const [form, setForm] = useState<Settings>(settings);

  // Re-sync the form when the underlying settings change (e.g. after hydrate
  // from Supabase). This is intentionally NOT tied to wallet connection state —
  // wallet connect/disconnect must never reset business profile fields.
  useEffect(() => {
    setForm(settings);
  }, [
    settings.businessName,
    settings.businessEmail,
    settings.businessAddress,
    settings.logo,
    settings.invoicePrefix,
    settings.nextInvoiceNumber,
    settings.defaultPaymentTermsDays,
    settings.defaultTaxRate,
    settings.invoiceFooter,
    settings.defaultCurrency,
    settings.showAdvanced,
  ]);

  const save = () => { saveSettings(form); toast.success("Settings saved"); };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your business and Lightning wallet.</p>
      </div>

      <Card title="Business">
        <Field label="Business name"><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} /></Field>
        <Field label="Address"><Textarea rows={2} value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} /></Field>
      </Card>

      <Card title="Lightning wallet">
        <WalletCard />
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
              className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
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
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h2 className="sticky top-0 -mx-6 -mt-6 mb-1 rounded-t-lg bg-card/95 px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur z-10">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Wallet section is isolated in its own component so that re-renders triggered
 * by `useWalletConnect()` (connect / disconnect / reconnect) never bubble up
 * into the SettingsPage form state. The business profile fields stay intact.
 */
function WalletCard() {
  const { connect, disconnect, isConnected, walletInfo, connectionType } = useWalletConnect();
  return (
    <>
      {isConnected && walletInfo ? (
        <div className="space-y-3">
          <div className="rounded-md border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Zap className="h-5 w-5 fill-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold">
                  <span className="truncate">{walletInfo.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{walletInfo.address}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  {connectionType?.replace("-", " ")} · {walletInfo.currency}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect} className="mt-3 w-full sm:w-auto">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your wallet credentials are encrypted and stored locally in this browser.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a Lightning wallet to start accepting Bitcoin payments on your invoices.
            Supports Blink Lightning Address, Nostr Wallet Connect (NWC), and Blink API key.
          </p>
          <Button onClick={connect} className="w-full sm:w-auto">
            <Zap className="mr-1.5 h-4 w-4" /> Connect wallet
          </Button>
        </div>
      )}

      <LightningConnect
        theme={{
          primary: "#F7931A",
          background: "#0A0A0A",
          foreground: "#F2F2F2",
          border: "#2A2A2A",
          radius: "12px",
          muted: "#A1A1AA",
        }}
        onConnect={(c) => toast.success(`Connected ${c.type.replace("-", " ")} wallet`)}
      />
    </>
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
