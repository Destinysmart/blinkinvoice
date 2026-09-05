import { LightningConnect, useWalletConnect } from "lightningconnect";
import { CheckCircle2, Zap, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Isolates Lightning wallet UI + `useWalletConnect` re-renders from the
 * Settings business-info form so connecting/disconnecting a wallet never
 * resets the business profile fields.
 */
export function WalletCard() {
  const { connect, disconnect, isConnected, walletInfo, connectionType } = useWalletConnect();

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lightning wallet</h2>

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
            Connect any Lightning wallet to start accepting Bitcoin payments on your invoices.
            Supports Lightning Address and Nostr Wallet Connect (NWC).
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
    </div>
  );
}
