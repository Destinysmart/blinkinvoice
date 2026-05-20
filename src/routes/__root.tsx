import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import { useEffect } from "react";
import { InstallBanner } from "@/components/InstallBanner";
import { OfflineBar } from "@/components/OfflineBar";

import appCss from "../styles.css?url";
import { Sidebar, MobileBar } from "../components/Sidebar";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const AUTH_ROUTES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#F7931A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Blink Invoice" },
      { title: "Blink Invoice" },
      { name: "description", content: "Send invoices, get paid over Lightning." },
      { property: "og:title", content: "Blink Invoice" },
      { name: "twitter:title", content: "Blink Invoice" },
      { property: "og:description", content: "Send invoices, get paid over Lightning." },
      { name: "twitter:description", content: "Send invoices, get paid over Lightning." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/6d0b2f85-93c3-40e5-966e-d39c05b70153" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/6d0b2f85-93c3-40e5-966e-d39c05b70153" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Register service worker — only on real published origin, never in editor iframe / preview hosts
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let inIframe = false;
    try { inIframe = window.self !== window.top; } catch { inIframe = true; }
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.endsWith("lovable.dev") ||
      host === "localhost";

    if (inIframe || isPreview) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.onupdatefound = () => {
        const w = reg.installing;
        if (!w) return;
        w.onstatechange = () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            toast("Update available", { description: "Refresh to get the latest version." });
          }
        };
      };
    }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBar />
      <AppFrame />
      <InstallBanner />
      <Toaster theme="dark" position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

function AppFrame() {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.has(location.pathname);
  const isPublicRoute = location.pathname.startsWith("/pay/");
  const hydrate = useAppStore((s) => s.hydrate);
  const resetStore = useAppStore((s) => s.reset);
  const hydratedUserId = useAppStore((s) => s.userId);
  const hydrated = useAppStore((s) => s.hydrated);

  // Invalidate cache + sync local store on auth state change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.invalidateQueries();
      router.invalidate();
      if (!session) resetStore();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router, resetStore]);

  // Hydrate the local store from Supabase whenever the signed-in user changes
  useEffect(() => {
    if (!user) return;
    if (hydratedUserId !== user.id) {
      hydrate(user.id);
    }
  }, [user, hydratedUserId, hydrate]);

  // Redirect rules
  useEffect(() => {
    if (loading) return;
    if (isPublicRoute) return;
    if (!isAuthenticated && !isAuthRoute) {
      navigate({ to: "/login" });
    } else if (isAuthenticated && isAuthRoute && location.pathname !== "/reset-password") {
      navigate({ to: "/" });
    }
  }, [loading, isAuthenticated, isAuthRoute, isPublicRoute, location.pathname, navigate]);

  if (loading && !isPublicRoute) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Loading</p>
        </div>
      </div>
    );
  }

  if (isAuthRoute || isPublicRoute) {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {!hydrated && (
        <div className="fixed left-0 right-0 top-0 z-50 h-[2px] bg-primary/20">
          <div className="h-full bg-primary animate-[topbar_1.2s_ease-out_infinite]" style={{ width: "40%" }} />
          <style>{`@keyframes topbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
        </div>
      )}
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileBar />
        <main className="flex-1 px-4 py-5 md:px-10 md:py-10 animate-in fade-in duration-200">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
