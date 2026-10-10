import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <Inbox className="mx-auto size-10 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="mx-auto size-8 text-destructive" />
      <p className="mt-3 font-semibold">حصلت مشكلة أثناء التحميل</p>
      {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>حاول مرة تانية</Button>}
    </div>
  );
}
