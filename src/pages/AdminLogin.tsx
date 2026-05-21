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
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full mb-4"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `https://queuesnap.vercel.app${next}`,
                  },
                });
                if (error) throw error;
              } catch (err: any) {
                toast.error(err?.message ?? "Google sign-in failed");
                setLoading(false);
              }
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>
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
