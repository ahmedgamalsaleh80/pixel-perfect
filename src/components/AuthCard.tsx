import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-hero-gradient px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card-gradient p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="mt-1 text-xs text-destructive" role="alert">{msg}</p> : null;
}
