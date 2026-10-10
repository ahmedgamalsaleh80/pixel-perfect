import { createFileRoute, redirect } from "@tanstack/react-router";

// Old sign-in URL kept working: /auth → /login, /auth?mode=register → /register
export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search }) => {
    const mode = (search as Record<string, unknown>)["mode"];
    throw redirect({ to: mode === "register" ? "/register" : "/login" });
  },
});
