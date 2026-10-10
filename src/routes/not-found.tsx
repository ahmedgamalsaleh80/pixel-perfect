import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
  head: () => ({
    meta: [
      { title: "الصفحة غير موجودة — منصة المهندس أحمد جمال" },
      { name: "description", content: "الصفحة المطلوبة غير موجودة." },
      { property: "og:title", content: "الصفحة غير موجودة" },
      { property: "og:description", content: "الصفحة المطلوبة غير موجودة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotFoundPage,
});

export function NotFoundPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4" aria-labelledby="nf-title">
      <div className="max-w-md text-center">
        <p className="font-display text-7xl font-extrabold text-primary">404</p>
        <h1 id="nf-title" className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة اللي بتدور عليها مش موجودة، أو مش مسموحلك تشوفها.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">العودة للرئيسية</Link>
      </div>
    </main>
  );
}
