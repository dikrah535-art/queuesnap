import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { isRecoveryMode } from "@/lib/recovery";
import { useAuth } from "@/lib/auth";

/** Requires a signed-in user (any role). Used for /workspaces and admin pages. */
export const WorkspaceAuthGate = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<"loading" | "ok" | "no" | "recovery">("loading");
  const { ready, user } = useAuth();

  useEffect(() => {
    if (isRecoveryMode()) { setState("recovery"); return; }
    if (!ready) { setState("loading"); return; }
    setState(user ? "ok" : "no");
  }, [ready, user]);

  if (state === "loading") return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (state === "recovery") return <Navigate to="/reset-password" replace />;
  if (state === "no") return <Navigate to="/admin/login?next=/workspaces" replace />;
  return <>{children}</>;
};
