import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

type Props = Omit<ImageProps, 'src' | 'alt'> & { src?: string | null; alt?: string | null; className?: string };

/**
 * Renders media from the library. Raster images from Supabase Storage go through next/image
 * (responsive sizes + AVIF/WebP). SVG artwork and unknown hosts render as a plain lazy <img>.
 */
export function Media({ src, alt, className, fill, sizes, priority, width, height, ...rest }: Props) {
  if (!src) return <div className={cn('bg-panel', className)} aria-hidden />;
  const isSvg = /\.svg(\?|$)/i.test(src);
  const optimizable = !isSvg && (src.startsWith('/') || /\.supabase\.co\/storage\/v1\/object\/public\//.test(src));
  if (!optimizable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ''} loading={priority ? 'eager' : 'lazy'} decoding="async"
        className={cn(fill && 'absolute inset-0 h-full w-full', 'object-cover', className)} width={fill ? undefined : (width as number)} height={fill ? undefined : (height as number)} />
    );
  }
  return (
    <Image src={src} alt={alt ?? ''} fill={fill} sizes={sizes ?? (fill ? '100vw' : undefined)} priority={priority}
      width={fill ? undefined : (width ?? 800)} height={fill ? undefined : (height ?? 1000)} className={cn('object-cover', className)} quality={75} {...rest} />
  );
}

export function Video({ src, poster, className }: { src: string; poster?: string | null; className?: string }) {
  return <video src={src} poster={poster ?? undefined} className={cn('h-full w-full object-cover', className)} autoPlay muted loop playsInline preload="metadata" />;
}
