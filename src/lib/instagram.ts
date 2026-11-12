// Instagram links pasted in Admin → Social. No API token involved: a post or reel link is turned
// into Instagram's own embed, which the storefront frames (see InstagramTile).

export type InstagramRef = { code: string; kind: 'reel' | 'post'; permalink: string; embedUrl: string };

/** Height of the profile bar Instagram draws above the media in its embed, in the embed's own px. */
export const IG_EMBED_HEADER = 54;
/** Instagram's embed stops laying out properly below this width, so narrower tiles scale it down. */
export const IG_EMBED_MIN_WIDTH = 328;

/**
 * Accepts the links Instagram's "Copy link" gives out — /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE,
 * with or without a username in front or tracking parameters behind. Profile links return null.
 */
export function parseInstagramUrl(input?: string | null): InstagramRef | null {
  if (!input) return null;
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); } catch { return null; }
  if (!/^(www\.|m\.)?(instagram\.com|instagr\.am)$/i.test(url.hostname)) return null;
  const m = /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})(?:\/|$)/.exec(url.pathname);
  if (!m) return null;
  const kind = m[1] === 'p' ? 'post' : 'reel';
  const path = `${kind === 'post' ? 'p' : 'reel'}/${m[2]}`;
  return { code: m[2], kind, permalink: `https://www.instagram.com/${path}/`, embedUrl: `https://www.instagram.com/${path}/embed/` };
}
