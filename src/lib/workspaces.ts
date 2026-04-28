import { supabase } from "@/integrations/supabase/client";

export type WorkspaceRole = "owner" | "admin" | "member";
export type LobbyStatus = "open" | "closed";
export type QueueEntryStatus = "waiting" | "serving" | "served" | "cancelled" | "collected";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  default_capacity: number;
  created_at: string;
  updated_at: string;
}

export interface Lobby {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  max_capacity: number;
  status: LobbyStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QueueEntry {
  id: string;
  lobby_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  device_type: string | null;
  position: number;
  status: QueueEntryStatus;
  created_at: string;
  served_at: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

// ---- Local anonymous-join token storage ----
// Anonymous users can't be tracked via auth, so we keep their entry id locally
// to allow status polling and cancel actions.
const ANON_KEY = "qs:anon-entries";

interface AnonEntryRef { lobbyId: string; entryId: string; name: string }

export function rememberAnonEntry(ref: AnonEntryRef) {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    const list: AnonEntryRef[] = raw ? JSON.parse(raw) : [];
    const next = [ref, ...list.filter((r) => r.lobbyId !== ref.lobbyId)].slice(0, 20);
    localStorage.setItem(ANON_KEY, JSON.stringify(next));
  } catch {}
}

export function getAnonEntryFor(lobbyId: string): AnonEntryRef | null {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (!raw) return null;
    const list: AnonEntryRef[] = JSON.parse(raw);
    return list.find((r) => r.lobbyId === lobbyId) ?? null;
  } catch { return null; }
}

export function forgetAnonEntry(lobbyId: string) {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (!raw) return;
    const list: AnonEntryRef[] = JSON.parse(raw);
    localStorage.setItem(ANON_KEY, JSON.stringify(list.filter((r) => r.lobbyId !== lobbyId)));
  } catch {}
}

// ---- Queries ----
export async function fetchMyWorkspaces() {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(name: string, description: string, defaultCapacity = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const cap = Math.max(1, Math.min(10000, Math.floor(defaultCapacity || 50)));
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: user.id,
      default_capacity: cap,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function fetchWorkspace(id: string) {
  const { data, error } = await supabase.from("workspaces").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Workspace;
}

export async function fetchLobbies(workspaceId: string) {
  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lobby[];
}

export async function createLobby(input: {
  workspace_id: string;
  name: string;
  description?: string;
  max_capacity: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("lobbies")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      max_capacity: input.max_capacity,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Lobby;
}

export async function updateLobby(id: string, patch: Partial<Pick<Lobby, "name" | "description" | "max_capacity" | "status">>) {
  const { data, error } = await supabase.from("lobbies").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Lobby;
}

export async function deleteLobby(id: string) {
  const { error } = await supabase.from("lobbies").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLobby(id: string) {
  const { data, error } = await supabase.from("lobbies").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Lobby;
}

export async function fetchQueueEntries(
  lobbyId: string,
  opts: { includeAll?: boolean } = {},
) {
  let q = supabase
    .from("queue_entries")
    .select("*")
    .eq("lobby_id", lobbyId);
  if (!opts.includeAll) q = q.in("status", ["waiting", "serving"]);
  const { data, error } = await q.order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QueueEntry[];
}

export async function joinLobby(
  lobbyId: string,
  name: string,
  extra: { phone?: string; deviceType?: string } = {},
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("join_lobby", {
    _lobby_id: lobbyId,
    _name: name,
    _user_id: user?.id ?? null,
    _phone: extra.phone ?? null,
    _device_type: extra.deviceType ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as QueueEntry;
}

export async function markCollected(entryId: string) {
  const { data, error } = await supabase.rpc("mark_collected", { _entry_id: entryId } as never);
  if (error) throw error;
  return data as unknown as QueueEntry;
}

export async function serveNext(lobbyId: string) {
  const { data, error } = await supabase.rpc("serve_next", { _lobby_id: lobbyId });
  if (error) throw error;
  return data as unknown as QueueEntry | null;
}

export async function clearQueue(lobbyId: string) {
  const { data, error } = await supabase.rpc("clear_queue", { _lobby_id: lobbyId });
  if (error) throw error;
  return data as number;
}

export async function cancelEntry(entryId: string) {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId);
  if (error) throw error;
}

export async function fetchMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkspaceMember[];
}

export async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function addAdminByEmail(workspaceId: string, email: string) {
  const { data, error } = await supabase.rpc("add_workspace_admin_by_email", {
    _workspace_id: workspaceId,
    _email: email,
  });
  if (error) throw error;
  return data as unknown as WorkspaceMember;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function getMyRole(workspaceId: string): Promise<WorkspaceRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.role as WorkspaceRole) ?? null;
}
