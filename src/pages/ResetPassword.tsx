import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check immediately in case event already fired
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      nav("/admin/login", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not update password");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-hero text-primary-foreground grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-4 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <Link to="/admin/login"><ArrowLeft /> Back to sign in</Link>
        </Button>
        <div className="rounded-2xl border border-primary-foreground/10 bg-card text-card-foreground p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground"><KeyRound className="h-5 w-5" /></div>
            <h1 className="text-xl font-bold">Set new password</h1>
          </div>
          {!ready ? (
            <p className="text-sm text-muted-foreground">Open this page from the password reset link in your email.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><Label htmlFor="np">New password</Label><Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
              <div><Label htmlFor="cp">Confirm password</Label><Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} /></div>
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
