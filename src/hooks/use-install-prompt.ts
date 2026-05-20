import { useEffect, useRef, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type InstallState = {
  /** Native install prompt available (Chrome, Edge, Android). */
  canInstall: boolean;
  /** App already running as a standalone/installed PWA. */
  isInstalled: boolean;
  /** Running inside iOS Safari — needs manual "Add to Home Screen". */
  isIOS: boolean;
  /** Fire the native install prompt. No-op if not available. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function useInstallPrompt(): InstallState {
  const deferred = useRef<BIPEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BIPEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    const ev = deferred.current;
    if (!ev) return "unavailable" as const;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred.current = null;
    setCanInstall(false);
    return outcome as "accepted" | "dismissed";
  };

  return { canInstall, isInstalled, isIOS, promptInstall };
}
