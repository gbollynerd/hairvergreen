import type { ProductMedia } from '@/lib/types';

/** Best still image for link previews: the first photo, or a video's thumbnail if the product only has video. */
export function shareImage(media: ProductMedia[] | undefined | null): string | null {
  if (!media?.length) return null;
  const photo = media.find((m) => m.media.kind === 'image');
  if (photo) return photo.media.url;
  return media.find((m) => m.media.kind === 'video' && m.media.metadata?.poster)?.media.metadata?.poster ?? null;
}
