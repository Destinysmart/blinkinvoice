import { useState } from "react";
import { Download, Smartphone, CheckCircle2, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { toast } from "sonner";

export function InstallAppCard() {
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <div>
          <div className="text-sm font-medium">BlinkInvoice is installed</div>
          <div className="text-xs text-muted-foreground">You're running the installed app.</div>
        </div>
      </div>
    );
  }

  const onClick = async () => {
    if (isIOS) {
      setShowIosHelp(true);
      return;
    }
    const result = await promptInstall();
    if (result === "unavailable") {
      toast.message("Install from your browser menu", {
        description: "Open your browser menu and choose “Install app” or “Add to Home screen”.",
      });
    } else if (result === "accepted") {
      toast.success("Installing BlinkInvoice");
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary shrink-0">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Install BlinkInvoice on this device</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Works on Mac, Windows, Linux, iPhone and Android. One tap, no app store.
          </p>
        </div>
      </div>
      <Button onClick={onClick} className="w-full sm:w-auto" size="sm">
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {isIOS ? "How to install on iPhone" : "Install app"}
      </Button>
      {showIosHelp && isIOS && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">Add to Home Screen</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Tap the <Share className="inline h-3 w-3" /> Share icon in Safari.</li>
            <li>Scroll and tap <span className="font-medium text-foreground">Add to Home Screen</span>.</li>
            <li>Tap <span className="font-medium text-foreground">Add</span>.</li>
          </ol>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Native desktop & mobile apps (Mac, Windows, iOS, Android) coming soon.
      </p>
    </div>
  );
}
