import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isRecoveryMode } from "@/lib/recovery";

const AdminLogin = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If the user landed here while a password-recovery session is active,
    // do NOT auto-redirect into the admin area — send them to reset first.
    if (isRecoveryMode()) { nav("/reset-password", { replace: true }); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.session.user.id).eq("role", "admin").maybeSingle();
      if (role) nav("/admin", { replace: true });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        // Auto-confirm is on; sign in immediately to establish session
        const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) throw siErr;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id).eq("role", "admin").maybeSingle();
        if (role) nav("/admin", { replace: true });
        else toast.error("This account is not an admin");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-hero text-primary-foreground grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-4 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/"><ArrowLeft /> Back</Link></Button>
        <div className="rounded-2xl border border-primary-foreground/10 bg-card text-card-foreground p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground"><ShieldCheck className="h-5 w-5" /></div>
            <h1 className="text-xl font-bold">Admin {mode === "signup" ? "sign up" : "sign in"}</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label htmlFor="p">Password</Label><Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} {mode === "signup" ? "Create account" : "Sign in"}</Button>
          </form>
          <button type="button" className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "First admin? Create account" : "Have an account? Sign in"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              className="mt-2 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={async () => {
                if (!email) return toast.error("Enter your email first");
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent. Check your inbox.");
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
