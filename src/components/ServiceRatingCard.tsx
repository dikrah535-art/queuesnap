import { useState } from "react";
import { Star, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  entryId: string;
  lobbyId: string;
  workspaceId: string;
  queueName: string;
  onDone?: () => void;
};

const STORAGE_PREFIX = "qsnap-rated:";

export function hasRatedEntry(entryId: string) {
  try { return localStorage.getItem(STORAGE_PREFIX + entryId) === "1"; } catch { return false; }
}

export const ServiceRatingCard = ({ entryId, lobbyId, workspaceId, queueName, onDone }: Props) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(hasRatedEntry(entryId));

  const submit = async () => {
    if (!rating) { toast.error("Pick a star rating first"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("service_ratings").insert({
        entry_id: entryId,
        lobby_id: lobbyId,
        workspace_id: workspaceId,
        rating,
        comment: comment.trim() || null,
      } as never);
      if (error) throw error;
      try { localStorage.setItem(STORAGE_PREFIX + entryId, "1"); } catch {}
      setDone(true);
      toast.success("Thanks for your feedback! 🙏");
      onDone?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit rating");
    } finally { setSaving(false); }
  };

  if (done) {
    return (
      <Card className="p-5 mt-4 border-primary/40 bg-primary/5 text-center animate-fade-in">
        <Check className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 font-medium">Thanks for rating {queueName}!</p>
        <p className="text-xs text-muted-foreground">Your feedback helps the team improve.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 mt-4 animate-scale-in">
      <h3 className="font-semibold">How was your experience?</h3>
      <p className="text-xs text-muted-foreground mt-1">Rate your service at {queueName}</p>
      <div className="mt-4 flex items-center justify-center gap-1">
        {[1,2,3,4,5].map((n) => {
          const active = (hover || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} stars`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star className={`h-8 w-8 ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          );
        })}
      </div>
      <Textarea
        placeholder="Tell us more (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        className="mt-4"
      />
      <Button className="mt-3 w-full" variant="hero" onClick={submit} disabled={saving || !rating}>
        {saving ? <Loader2 className="animate-spin" /> : "Submit rating"}
      </Button>
    </Card>
  );
};

export default ServiceRatingCard;
