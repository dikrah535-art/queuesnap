import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isRecoveryMode, setRecoveryMode } from "@/lib/recovery";

const ResetPassword = () => {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The recovery hash (e.g. #access_token=...&type=recovery) signals a
    // fresh email click. Mark the session as recovery-only so guards block
    // admin access until we finish here.
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) setRecoveryMode(true);

    // Detect explicit error returns from Supabase (expired/invalid links).
    if (hash.includes("error=") || hash.includes("error_code=")) {
      setExpired(true);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { setRecoveryMode(true); setReady(true); }
    });

    // Also check immediately in case the event already fired before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && (isRecoveryMode() || hash.includes("type=recovery"))) {
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Clear recovery flag and force a fresh, deliberate sign-in.
      setRecoveryMode(false);
      await supabase.auth.signOut();
      toast.success("Password updated successfully. Please login.");
      nav("/admin/login", { replace: true });
    } catch (err: any) {
      const msg = err?.message ?? "Could not update password";
      if (/expired|invalid|token/i.test(msg)) setExpired(true);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-hero text-primary-foreground grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-4 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <Link to="/admin/login" onClick={() => { setRecoveryMode(false); supabase.auth.signOut(); }}><ArrowLeft /> Back to sign in</Link>
        </Button>
        <div className="rounded-2xl border border-primary-foreground/10 bg-card text-card-foreground p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground"><KeyRound className="h-5 w-5" /></div>
            <h1 className="text-xl font-bold">Set new password</h1>
          </div>
          {expired ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">Link expired. Request a new one.</p>
              <Button asChild variant="hero" size="lg" className="w-full">
                <Link to="/admin/login" onClick={() => { setRecoveryMode(false); supabase.auth.signOut(); }}>Back to sign in</Link>
              </Button>
            </div>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">Open this page from the password reset link in your email.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><Label htmlFor="np">New password</Label><Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></div>
              <div><Label htmlFor="cp">Confirm password</Label><Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" /></div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />} Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
