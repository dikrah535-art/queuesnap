import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Sparkles } from "lucide-react";

const AdminDemoLogin = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/admin-dashboard");
  };

  return (
    <div className="min-h-screen bg-hero grid place-items-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Demo Login</h1>
          <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Demo mode — no real authentication
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" defaultValue="Agresh Ji" readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" defaultValue="••••••••" readOnly />
          </div>
          <Button type="submit" variant="hero" className="w-full">
            Login to Demo
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminDemoLogin;
