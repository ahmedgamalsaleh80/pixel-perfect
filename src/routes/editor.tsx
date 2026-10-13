import { createFileRoute } from "@tanstack/react-router";
import { CodeEditor } from "@/components/CodeEditor";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "محرر الأكواد — منصة المهندس أحمد جمال" },
      { name: "description", content: "اكتب وشغّل أكواد Python و JavaScript و HTML و CSS واحفظها على جهازك." },
      { property: "og:title", content: "محرر الأكواد — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "محرر أكواد للتدريب: Python و JavaScript و HTML و CSS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">محرر الأكواد</h1>
      <p className="mt-2 text-muted-foreground">اكتب الكود وشغّله، واحفظه على جهازك بالاسم اللي تحبه أو افتح ملف قديم.</p>
      <div className="mt-6"><CodeEditor /></div>
    </div>
  ),
});
