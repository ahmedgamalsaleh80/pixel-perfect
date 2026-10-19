```tsx
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle, InstallButton } from "@/components/ThemeInstall";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, useMe } from "@/lib/auth";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          الصفحة غير موجودة
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة اللي بتدور عليها مش موجودة أو اتنقلت لمكان تاني.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);

  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          حصلت مشكلة أثناء تحميل الصفحة
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          حدث خطأ غير متوقع. جرّب تحديث الصفحة أو العودة للرئيسية.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            حاول مرة أخرى
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "منصة المهندس أحمد جمال — نفهم قبل ما نبرمج يا هندسة",
      },
      {
        name: "description",
        content:
          "منصة تعليمية متخصصة في كورسات البرمجة والذكاء الاصطناعي باللغة العربية مع المهندس أحمد جمال.",
      },
      {
        property: "og:title",
        content: "منصة المهندس أحمد جمال",
      },
      {
        property: "og:description",
        content:
          "نفهم قبل ما نبرمج يا هندسة — كورسات برمجة وذكاء اصطناعي بالعربي.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "/favicon.png",
        type: "image/png",
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "apple-touch-icon",
        href: "/icon-512.png",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.add("light")}catch(e){}',
          }}
        />
        <HeadContent />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const { data: me } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    router.navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img
              src="/logo.png"
              alt="شعار منصة المهندس أحمد جمال"
              className="h-full w-full object-contain"
              width={36}
              height={36}
            />
          </span>

          <span className="font-display text-lg font-bold leading-tight">
            منصة المهندس أحمد جمال
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link
            to="/"
            className="transition-colors hover:text-foreground"
            activeProps={{
              className: "text-foreground font-semibold",
            }}
          >
            الرئيسية
          </Link>

          <Link
            to="/courses"
            className="transition-colors hover:text-foreground"
            activeProps={{
              className: "text-foreground font-semibold",
            }}
          >
            الكورسات
          </Link>

          <Link
            to="/editor"
            className="transition-colors hover:text-foreground"
            activeProps={{
              className: "text-foreground font-semibold",
            }}
          >
            محرر الأكواد
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <InstallButton />

          {me ? (
            <>
              <Link
                to={me.isAdmin ? "/admin" : "/dashboard"}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {me.isAdmin ? "لوحة الأدمن" : "لوحتي"}
              </Link>

              <Link
                to="/profile"
                className="hidden max-w-32 truncate rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                {me.profile?.full_name || "حسابي"}
              </Link>

              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <LogOut className="size-4" />
                خروج
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                تسجيل الدخول
              </Link>

              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                إنشاء حساب
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <p className="font-display font-bold">
          منصة المهندس أحمد جمال
        </p>

        <p className="text-sm text-muted-foreground">
          نفهم قبل ما نبرمج يا هندسة
        </p>

        <p className="text-xs text-muted-foreground/70">
          جميع الحقوق محفوظة © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }

      queryClient.invalidateQueries({
        queryKey: meQuery.queryKey,
      });

      router.invalidate();
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />

        <main className="flex-1">
          <Outlet />
        </main>

        <SiteFooter />
      </div>

      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
```
