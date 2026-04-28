import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isRecoveryMode } from "@/lib/recovery";

/** Requires a signed-in user (any role). Used for /workspaces and admin pages. */
export const WorkspaceAuthGate = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<"loading" | "ok" | "no" | "recovery">("loading");

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (isRecoveryMode()) { if (mounted) setState("recovery"); return; }
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!mounted) return;
      setState(user && !error ? "ok" : "no");
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (state === "loading") return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (state === "recovery") return <Navigate to="/reset-password" replace />;
  if (state === "no") return <Navigate to="/admin/login?next=/workspaces" replace />;
  return <>{children}</>;
};
