import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setRecoveryMode, isRecoveryMode } from "@/lib/recovery";

/**
 * Global listener that intercepts Supabase password-recovery events.
 *
 * When the user clicks a reset link in their email, Supabase parses the
 * token from the URL hash and fires `PASSWORD_RECOVERY`. Without this
 * watcher, the SDK also sets a session, which previously let the user
 * walk straight into the admin dashboard. Here we mark the session as
 * "recovery only" and force navigation to /reset-password.
 */
export const RecoveryWatcher = () => {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    // If the URL hash carries a recovery token (fresh email click), flag it
    // immediately — before the Supabase listener even fires — so guards
    // never see a "normal" admin session.
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) {
      setRecoveryMode(true);
      if (loc.pathname !== "/reset-password") {
        nav("/reset-password" + window.location.hash, { replace: true });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        if (window.location.pathname !== "/reset-password") {
          nav("/reset-password", { replace: true });
        }
      }
      // Once the user fully signs out (after completing reset), clear the flag.
      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
      }
    });

    // If we're already mid-recovery on a non-reset route (e.g. user typed
    // /admin while the flag is set), bounce them back.
    if (isRecoveryMode() && loc.pathname !== "/reset-password") {
      nav("/reset-password", { replace: true });
    }

    return () => sub.subscription.unsubscribe();
  }, [nav, loc.pathname]);

  return null;
};
