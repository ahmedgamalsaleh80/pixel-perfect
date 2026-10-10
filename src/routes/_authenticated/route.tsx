// Client-only gate for signed-in pages. This is a UX redirect only:
// every read/write is enforced by database row-level security.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me) throw redirect({ to: "/login" });
    const approved = me.profile?.account_status === "approved";
    const isAdminArea = location.pathname.startsWith("/admin");
    if (isAdminArea && !me.isAdmin) throw redirect({ to: "/dashboard" });
    if (!me.isAdmin && !approved && location.pathname !== "/profile") throw redirect({ to: "/pending-approval" });
    return { me };
  },
  component: () => <Outlet />,
});
