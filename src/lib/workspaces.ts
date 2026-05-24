import { supabase } from "@/integrations/supabase/client";

export type WorkspaceRole = "owner" | "admin" | "member";
export type LobbyStatus = "open" | "closed";
export type QueueEntryStatus = "waiting" | "serving" | "served" | "cancelled" | "collected";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  user_id?: string;
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
  slug?: string | null;
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
  email?: string | null;
  is_vip?: boolean;
  notified_email?: boolean;
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Authentication required");
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(name: string, description: string, defaultCapacity = 50, userId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const id = userId ?? session?.user.id;
  if (!id || !session?.user) throw new Error("Authentication required");
  const cap = Math.max(1, Math.min(10000, Math.floor(defaultCapacity || 50)));
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      user_id: id,
      owner_id: id,
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
    .select("id, lobby_id, user_id, name, device_type, position, status, created_at, served_at")
    .eq("lobby_id", lobbyId);
  if (!opts.includeAll) q = q.in("status", ["waiting", "serving"]);
  const { data, error } = await q.order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Omit<QueueEntry, "phone">[]).map((e) => ({ ...e, phone: null })) as QueueEntry[];
}

export async function fetchLobbyEntriesAdmin(
  lobbyId: string,
  opts: { includeAll?: boolean } = {},
) {
  const { data, error } = await supabase.rpc("fetch_lobby_entries_admin", {
    _lobby_id: lobbyId,
    _include_all: opts.includeAll ?? false,
  } as never);
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

  // Check workspace_members first
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (data?.role) return data.role as WorkspaceRole;

  // Fallback: check if user is the owner directly in workspaces table
  const { data: ws } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ws) return "owner";

  return null;
}

// ---- Demo lobby helpers ----
export async function resolveLobbyKey(key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_lobby", { _key: key } as never);
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function fetchDemoWaitingCount(): Promise<number> {
  const { data, error } = await supabase.rpc("count_demo_waiting" as never);
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function recordDemoVisitor(input: {
  name: string; email?: string | null; phone?: string | null; queueEntryId?: string | null;
}) {
  const { error } = await supabase.from("demo_visitors").insert({
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    queue_entry_id: input.queueEntryId ?? null,
    source: "landing_page",
  } as never);
  if (error) console.warn("demo visitor insert failed", error);
}

export interface DemoVisitor {
  id: string; name: string; email: string | null; phone: string | null;
  queue_entry_id: string | null; visited_at: string; source: string;
}

export async function fetchDemoVisitors(): Promise<DemoVisitor[]> {
  const { data, error } = await supabase
    .from("demo_visitors")
    .select("*")
    .order("visited_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as DemoVisitor[];
}

export async function adminAddEntry(input: {
  lobbyId: string; name: string; phone?: string; email?: string; deviceType?: string; isVip?: boolean;
}) {
  const { data, error } = await supabase.rpc("admin_add_entry", {
    _lobby_id: input.lobbyId,
    _name: input.name,
    _phone: input.phone ?? null,
    _email: input.email ?? null,
    _device_type: input.deviceType ?? null,
    _is_vip: input.isVip ?? false,
  } as never);
  if (error) throw error;
  return data as unknown as QueueEntry;
}

export async function sendTokenEmail(input: {
  email: string; name: string; tokenNumber: number; queueName: string; tokenUrl: string;
}) {
  const { error } = await supabase.functions.invoke("notify-email", { body: input });
  if (error) throw error;
}

export async function markNotified(entryId: string) {
  await supabase.from("queue_entries").update({ notified_email: true } as never).eq("id", entryId);
}
