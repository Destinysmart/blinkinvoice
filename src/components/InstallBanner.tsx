import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallBanner() {
  const deferredRef = useRef<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BIPEvent;
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || dismissed) return null;

  const install = async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-[#F7931A] px-4 py-2.5 text-sm font-medium text-black shadow-lg">
      <span className="truncate">Install BlinkInvoice for faster access</span>
      <div className="flex items-center gap-2">
        <button
          onClick={install}
          className="rounded-md bg-black/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-md p-1.5 hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
