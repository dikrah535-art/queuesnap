import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isRecoveryMode } from "@/lib/recovery";

/**
 * Generic sign-in/sign-up. Anyone can sign up; access to a workspace is
 * granted automatically to its creator (owner) and explicitly via the
 * workspace admins page. There is no global "admin" role anymore.
 */
const AdminLogin = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/workspaces";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRecoveryMode()) { nav("/reset-password", { replace: true }); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav(next, { replace: true });
    });
  }, [nav, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) throw siErr;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav(next, { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Sign in failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-hero text-primary-foreground grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-4 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/"><ArrowLeft /> Back</Link></Button>
        <div className="rounded-2xl border border-primary-foreground/10 bg-card text-card-foreground p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground"><ShieldCheck className="h-5 w-5" /></div>
            <h1 className="text-xl font-bold">{mode === "signup" ? "Create account" : "Sign in"}</h1>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Sign up to create your first workspace."
              : "Sign in to manage your workspaces and queues."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label htmlFor="p">Password</Label><PasswordInput id="p" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} {mode === "signup" ? "Create account" : "Sign in"}</Button>
          </form>
          <button type="button" className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "New here? Create account" : "Have an account? Sign in"}
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
