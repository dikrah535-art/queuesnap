import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  owner_name: z.string().trim().min(2, "Name is too short").max(80),
  owner_id_text: z.string().trim().max(40).optional(),
  owner_email: z.string().trim().email().max(120).optional().or(z.literal("")),
  slot_id: z.string().uuid("Choose a slot"),
});

interface Slot { id: string; label: string; is_occupied: boolean; }

const CheckIn = () => {
  const nav = useNavigate();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ owner_name: "", owner_id_text: "", owner_email: "", slot_id: "" });

  useEffect(() => {
    supabase.from("slots").select("*").eq("is_occupied", false).order("label").then(({ data }) => {
      setSlots((data as Slot[]) ?? []);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const slot = slots.find((s) => s.id === form.slot_id);
    const { data, error } = await supabase.from("devices").insert({
      owner_name: form.owner_name.trim(),
      owner_id_text: form.owner_id_text?.trim() || null,
      owner_email: form.owner_email?.trim() || null,
      slot_id: form.slot_id,
      slot_label: slot?.label,
    }).select("id, token_code").single();
    if (error || !data) { toast.error(error?.message ?? "Check-in failed"); setLoading(false); return; }
    await supabase.from("slots").update({ is_occupied: true }).eq("id", form.slot_id);
    toast.success(`Token ${data.token_code} issued`);
    nav(`/receipt/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Back</Link></Button>
          <div className="flex items-center gap-2 ml-auto">
            <Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Self check-in</span>
          </div>
        </div>
      </header>
      <main className="container max-w-md py-8">
        <h1 className="text-2xl font-bold">Submit your device</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in your details and pick an available slot. You'll get a digital receipt.</p>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} maxLength={80} required />
          </div>
          <div>
            <Label htmlFor="idn">ID / Reg no.</Label>
            <Input id="idn" value={form.owner_id_text} onChange={(e) => setForm({ ...form, owner_id_text: e.target.value })} maxLength={40} />
          </div>
          <div>
            <Label htmlFor="email">Email (optional, for backup link)</Label>
            <Input id="email" type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} maxLength={120} />
          </div>
          <div>
            <Label>Slot *</Label>
            <Select value={form.slot_id} onValueChange={(v) => setForm({ ...form, slot_id: v })}>
              <SelectTrigger><SelectValue placeholder={slots.length ? "Choose a free slot" : "No slots available"} /></SelectTrigger>
              <SelectContent>
                {slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Generate token & QR
          </Button>
        </form>
      </main>
    </div>
  );
};

export default CheckIn;
