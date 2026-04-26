import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";

const PHONE_MODELS = [
  "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "iPhone 14", "iPhone 13", "iPhone 12", "iPhone SE",
  "Samsung Galaxy S25 Ultra", "Samsung Galaxy S25", "Samsung Galaxy S24", "Samsung Galaxy S23", "Samsung Galaxy A55", "Samsung Galaxy A35", "Samsung Galaxy A15",
  "OnePlus 13", "OnePlus 12", "OnePlus Nord 4", "OnePlus Nord CE 4",
  "Google Pixel 9 Pro", "Google Pixel 9", "Google Pixel 8a", "Google Pixel 8",
  "Xiaomi 15", "Xiaomi 14", "Redmi Note 14 Pro", "Redmi Note 13",
  "Realme GT 7 Pro", "Realme 13 Pro",
  "Vivo X200 Pro", "Vivo V40",
  "OPPO Find X8", "OPPO Reno 12",
  "Motorola Edge 50", "Motorola Razr 50",
  "Nothing Phone (2a)", "Nothing Phone (2)",
  "Other",
];

const schema = z.object({
  owner_name: z.string().trim().min(2, "Name is too short").max(80),
  owner_id_text: z.string().trim().max(40).optional(),
  owner_email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone_model: z.string().trim().min(1, "Select a phone model").max(120),
});

const CheckIn = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSelection, setModelSelection] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [form, setForm] = useState({ owner_name: "", owner_id_text: "", owner_email: "" });

  const phoneModel = modelSelection === "Other" ? customModel.trim() : modelSelection;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, phone_model: phoneModel });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    // Auto-assign the lowest free slot (or create the next one)
    const { data: slotRows, error: slotErr } = await supabase.rpc("assign_next_slot");
    const slot = Array.isArray(slotRows) ? slotRows[0] : null;
    if (slotErr || !slot) {
      toast.error(slotErr?.message ?? "Could not assign a slot");
      setLoading(false);
      return;
    }

    // Generate the token client-side so we can navigate without needing
    // SELECT-back permission (anon has no SELECT policy on devices for safety).
    const tokenCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const { error } = await supabase.from("devices").insert({
      owner_name: form.owner_name.trim(),
      owner_id_text: form.owner_id_text?.trim() || null,
      owner_email: form.owner_email?.trim() || null,
      slot_id: slot.slot_id,
      slot_label: slot.slot_label,
      phone_model: phoneModel || null,
      token_code: tokenCode,
    } as any);
    if (error) { toast.error(error.message ?? "Check-in failed"); setLoading(false); return; }

    // Look up the inserted device via SECURITY DEFINER RPC (bypasses RLS safely)
    const { data: rows } = await supabase.rpc("lookup_device", { _token: tokenCode });
    const created = Array.isArray(rows) ? rows[0] : null;
    if (!created) { toast.error("Check-in saved but lookup failed"); setLoading(false); return; }
    toast.success(`Token ${created.token_code} · ${slot.slot_label}`);
    nav(`/receipt/${created.id}`);
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
        <p className="mt-1 text-sm text-muted-foreground">Fill in your details. A slot will be assigned automatically and you'll get a digital receipt.</p>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} maxLength={80} required autoFocus />
          </div>
          <div>
            <Label htmlFor="idn">ID / Reg no.</Label>
            <Input id="idn" value={form.owner_id_text} onChange={(e) => setForm({ ...form, owner_id_text: e.target.value })} maxLength={40} />
          </div>
          <div>
            <Label htmlFor="email">Email (optional, for backup link)</Label>
            <Input id="email" type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} maxLength={120} />
          </div>

          {/* Phone model picker */}
          <div>
            <Label>Phone model *</Label>
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={modelOpen} className="w-full justify-between font-normal">
                  {modelSelection || "Select phone model…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search models…" />
                  <CommandList>
                    <CommandEmpty>No match found</CommandEmpty>
                    <CommandGroup>
                      {PHONE_MODELS.map((m) => (
                        <CommandItem key={m} value={m} onSelect={(v) => { setModelSelection(v); setModelOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", modelSelection === m ? "opacity-100" : "opacity-0")} />
                          {m}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {modelSelection === "Other" && (
              <Input className="mt-2" placeholder="Enter your phone model" value={customModel} onChange={(e) => setCustomModel(e.target.value)} maxLength={120} autoFocus />
            )}
          </div>

          <div className="rounded-lg border border-dashed bg-secondary/40 p-3 text-xs text-muted-foreground">
            A slot will be assigned automatically when you submit.
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
