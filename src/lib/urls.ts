/**
 * Canonical app URL builders. Always use these instead of `window.location.origin`
 * so QR codes / share links / emails point to the production domain regardless
 * of where the page is currently being viewed (preview, localhost, etc).
 */
const RAW = (import.meta.env.VITE_APP_URL as string | undefined) || "https://queuesnap.vercel.app";
export const BASE_URL = RAW.replace(/\/+$/, "");

export const getJoinUrl = (lobbyId: string) => `${BASE_URL}/join/${lobbyId}`;
export const getTokenUrl = (lobbyId: string, tokenId: string) =>
  `${BASE_URL}/join/${lobbyId}?token=${tokenId}`;
export const getPrintUrl = (lobbyId: string) => `${BASE_URL}/admin/lobby/${lobbyId}/print`;
