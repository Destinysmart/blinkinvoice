import { useEffect, useState } from "react";

export function OfflineBar() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-[#F7931A]/15 px-4 py-1.5 text-center text-xs font-medium text-[#F7931A] backdrop-blur">
      You're offline — changes will sync when reconnected
    </div>
  );
}
