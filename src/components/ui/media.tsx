import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

type Props = Omit<ImageProps, 'src' | 'alt'> & { src?: string | null; alt?: string | null; className?: string };

/**
 * Renders media from the library. Raster images from Supabase Storage go through next/image
 * (responsive sizes + AVIF/WebP). SVG artwork and unknown hosts render as a plain lazy <img>.
 */
export function Media({ src, alt, className, fill, sizes, priority, width, height, style, ...rest }: Props) {
  if (!src) return <div className={cn('bg-panel', className)} aria-hidden />;
  const isSvg = /\.svg(\?|$)/i.test(src);
  const optimizable = !isSvg && (src.startsWith('/') || /\.supabase\.co\/storage\/v1\/object\/public\//.test(src));
  if (!optimizable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ''} loading={priority ? 'eager' : 'lazy'} decoding="async"
        className={cn(fill && 'absolute inset-0 h-full w-full', 'object-cover', className)} style={style} width={fill ? undefined : (width as number)} height={fill ? undefined : (height as number)} />
    );
  }
  return (
    <Image src={src} alt={alt ?? ''} fill={fill} sizes={sizes ?? (fill ? '100vw' : undefined)} priority={priority}
      width={fill ? undefined : (width ?? 800)} height={fill ? undefined : (height ?? 1000)} className={cn('object-cover', className)} style={style} quality={75} {...rest} />
  );
}

export { Video } from './video';

/** `#t=` makes browsers (including iOS Safari) paint that frame instead of a blank box when there is no poster. */
export const videoFrameSrc = (url: string, at = 0.5) => (url.includes('#') ? url : `${url}#t=${at}`);

/**
 * A still for any product image or video: images render normally; videos show their thumbnail
 * (poster) or, if none was saved, the video's own early frame. Nothing plays here.
 */
export function MediaThumb({ item, alt, fill = true, sizes, priority, className }: {
  item?: { url: string; kind?: string; poster?: string | null; alt?: string } | null; alt?: string; fill?: boolean; sizes?: string; priority?: boolean; className?: string;
}) {
  if (!item?.url) return <div className={cn('bg-panel', fill && 'absolute inset-0', className)} aria-hidden />;
  if (item.kind === 'video') {
    if (item.poster) return <Media src={item.poster} alt={alt ?? item.alt ?? ''} fill={fill} sizes={sizes} priority={priority} className={className} />;
    return <video src={videoFrameSrc(item.url)} muted playsInline preload="metadata" aria-label={alt ?? item.alt ?? undefined} className={cn(fill && 'absolute inset-0', 'h-full w-full object-cover', className)} />;
  }
  return <Media src={item.url} alt={alt ?? item.alt ?? ''} fill={fill} sizes={sizes} priority={priority} className={className} />;
}
