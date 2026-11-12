// Instagram and TikTok links pasted in Admin → Social. No API token involved: a post link is turned
// into the platform’s own embed, which the storefront frames (see SocialEmbedTile).

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

export type TikTokRef = { id: string; permalink: string; embedUrl: string };

/** Short TikTok share links (vm.tiktok.com/…, tiktok.com/t/…) carry no video id until they are followed. */
export function isTikTokShortLink(input?: string | null): boolean {
  try {
    const url = new URL(String(input ?? '').trim());
    return /^(vm|vt)\.tiktok\.com$/i.test(url.hostname) || (/^(www\.|m\.)?tiktok\.com$/i.test(url.hostname) && /^\/t\/[A-Za-z0-9]+/.test(url.pathname));
  } catch { return false; }
}

/** Accepts tiktok.com/@name/video/ID and /photo/ID links (tracking parameters are dropped). Profile and short links return null. */
export function parseTikTokUrl(input?: string | null): TikTokRef | null {
  if (!input) return null;
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); } catch { return null; }
  if (!/^(www\.|m\.)?tiktok\.com$/i.test(url.hostname)) return null;
  const m = /^\/(@[A-Za-z0-9._]+)\/(video|photo)\/(\d{8,25})(?:\/|$)/.exec(url.pathname) ?? /^\/()(v|embed(?:\/v2)?|player\/v1)\/(\d{8,25})/.exec(url.pathname);
  if (!m) return null;
  const id = m[3];
  const permalink = m[1] ? `https://www.tiktok.com/${m[1]}/${m[2]}/${id}` : `https://www.tiktok.com/embed/v2/${id}`;
  return { id, permalink, embedUrl: `https://www.tiktok.com/player/v1/${id}?music_info=0&description=0&rel=0` };
}

export type SocialEmbed = { platform: 'instagram' | 'tiktok'; embedUrl: string; permalink: string; label: string };

/** The embed for a social gallery row, or null when the row should show its uploaded image or video instead. */
export function socialEmbed(platform: string, permalink?: string | null): SocialEmbed | null {
  if (platform === 'instagram') { const ig = parseInstagramUrl(permalink); return ig && { platform, embedUrl: ig.embedUrl, permalink: ig.permalink, label: ig.kind === 'reel' ? 'Reel' : 'Post' }; }
  if (platform === 'tiktok') { const tt = parseTikTokUrl(permalink); return tt && { platform, embedUrl: tt.embedUrl, permalink: tt.permalink, label: 'TikTok' }; }
  return null;
}
