import { supabase } from "@/integrations/supabase/client";

export interface Counter {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function fetchCounters(workspaceId: string): Promise<Counter[]> {
  const { data, error } = await supabase
    .from("counters" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Counter[];
}

export async function createCounter(workspaceId: string, name: string): Promise<Counter> {
  const { data, error } = await supabase
    .from("counters" as never)
    .insert({ workspace_id: workspaceId, name: name.trim() } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Counter;
}

export async function renameCounter(id: string, name: string): Promise<Counter> {
  const { data, error } = await supabase
    .from("counters" as never)
    .update({ name: name.trim() } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Counter;
}

export async function deleteCounter(id: string): Promise<void> {
  const { error } = await supabase.from("counters" as never).delete().eq("id", id);
  if (error) throw error;
}

// LocalStorage — remember which counter this admin is currently working at (per workspace)
const KEY = "qs:active-counter";
type Store = Record<string, string>;

export function getActiveCounter(workspaceId: string): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Store;
    return map[workspaceId] ?? null;
  } catch { return null; }
}

export function setActiveCounter(workspaceId: string, counterId: string | null): void {
  try {
    const raw = localStorage.getItem(KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Store;
    if (counterId) map[workspaceId] = counterId; else delete map[workspaceId];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}
