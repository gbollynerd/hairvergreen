import Link from 'next/link';
import { ArrowRight, Sparkles, Scissors, Globe2, Heart, ShieldCheck, Truck, Gem, Clock, Award, Star } from 'lucide-react';
import type { PageSection } from '@/lib/types';
import { Media, Video } from '@/components/ui/media';
import { Reveal } from '@/components/ui/reveal';
import { Stars } from '@/components/ui/stars';
import { ProductCard } from '@/components/store/product-card';
import { Price } from '@/components/store/price';
import { NewsletterForm } from '@/components/store/newsletter-form';
import { Accordion } from '@/components/ui/accordion';
import { ProductRail } from './product-rail';
import { Countdown } from './countdown';
import { listProducts, productsBySlugs, productsByIds, getFeaturedReviews, getAttributes, getCollection, toCard } from '@/lib/data/catalog';
import { getPosts, getSocialPosts } from '@/lib/data/content';
import { supabasePublic } from '@/lib/supabase/public';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn, formatDate } from '@/lib/utils';

type S = Record<string, any>;
const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  sparkle: Sparkles, scissors: Scissors, globe: Globe2, heart: Heart, shield: ShieldCheck, truck: Truck, gem: Gem, clock: Clock, award: Award, star: Star,
};

function Shell({ s, children, className, full }: { s: S; children: React.ReactNode; className?: string; full?: boolean }) {
  const bg = { panel: 'bg-panel', dark: 'bg-primary text-primary-contrast', surface: 'bg-surface', default: '' }[(s.background as string) || 'default'] ?? '';
  const pad = { none: '', sm: 'py-10 md:py-14', md: 'py-16 md:py-24', lg: 'py-20 md:py-32' }[(s.spacing as string) || 'md'];
  return (
    <section className={cn(bg, pad, s.hide_on_mobile && 'max-md:hidden', s.hide_on_desktop && 'md:hidden', className)} aria-label={s.heading || undefined}>
      {full ? children : <div className="container-x">{children}</div>}
    </section>
  );
}

function Heading({ s, center, dark }: { s: S; center?: boolean; dark?: boolean }) {
  if (!s.heading && !s.eyebrow) return null;
  return (
    <Reveal className={cn('mb-10 flex flex-col gap-3 md:mb-14', center ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between')}>
      <div className={cn(center && 'flex flex-col items-center')}>
        {s.eyebrow && <p className={cn('eyebrow mb-3', dark && '!text-accent')}>{s.eyebrow}</p>}
        {s.heading && <h2 className="display-2 max-w-3xl">{s.heading}</h2>}
        {s.text && center && <p className={cn('lede mt-4 max-w-2xl', dark && '!text-primary-contrast/75')}>{s.text}</p>}
      </div>
      {s.cta?.href && !center && <Link href={s.cta.href} className="caps link-underline flex items-center gap-2 self-start md:self-auto">{s.cta.label} <ArrowRight size={14} /></Link>}
    </Reveal>
  );
}

function Cta({ cta, dark, className }: { cta?: { label?: string; href?: string; style?: string }; dark?: boolean; className?: string }) {
  if (!cta?.href || !cta.label) return null;
  const style = cta.style === 'secondary' ? (dark ? 'btn-ghost-light' : 'btn-outline') : dark ? 'btn-light' : 'btn-primary';
  return <Link href={cta.href} className={cn('btn', style, className)}>{cta.label}</Link>;
}


/** Image or video for any section: videos play muted while on screen, with their thumbnail as the still. */
function SectionMedia({ m, sizes, alt, className, priority }: { m?: S | null; sizes: string; alt?: string; className?: string; priority?: boolean }) {
  if (!m?.url) return null;
  if (m.kind === 'video') return <Video src={m.url} poster={m.poster} className={cn('absolute inset-0', className)} />;
  return <Media src={m.url} alt={alt ?? m.alt ?? ''} fill sizes={sizes} priority={priority} className={className} />;
}

// ---------------------------------------------------------------------------
/** Renders *word* in a heading as an italic accent (e.g. "Luxury hair. *Beautifully* yours."). */
function accentText(text: string, accentClass: string) {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? <em key={i} className={cn('italic', accentClass)}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>);
}

async function HeroSplit({ s }: { s: S }) {
  const m = s.media ?? {}; const mm = s.mobile_media ?? {};
  const editorial = (s.font ?? 'editorial') === 'editorial';
  const trust: string[] = (Array.isArray(s.trust) ? s.trust : []).map((t: S) => (typeof t === 'string' ? t : t?.text)).filter(Boolean);
  const f = { product: s.feature_product, eyebrow: s.feature_eyebrow, title: s.feature_title, price_label: s.feature_price_label, href: s.feature_href };
  const featured = f.product ? (await productsBySlugs([f.product]))[0] : null;
  const fTitle = f.title || featured?.name;
  const fHref = f.href || (featured ? `/products/${featured.slug}` : null);
  const pos = s.focal || '50% 20%';
  const photo = (item: S, cls: string, sizes: string) => item.kind === 'video' && item.url
    ? <Video src={item.url} poster={item.poster} className={cls} />
    : item.url ? <Media src={item.url} alt={item.alt ?? ''} fill priority sizes={sizes} className={cn('animate-[fade-in_1.6s_ease]', cls)} style={{ objectPosition: pos }} /> : null;

  const featureCard = fTitle && fHref && (
    <Link href={fHref} className="group/feat flex items-center gap-5 bg-[#F4EFE6]/95 px-5 py-4 text-primary backdrop-blur-md transition-colors hover:bg-[#F4EFE6]">
      <span className="flex min-w-0 flex-col gap-1">
        {f.eyebrow && <span className="text-[11px] uppercase tracking-[0.22em] text-[#7A6A45]">{f.eyebrow}</span>}
        <span className={cn('truncate text-[17px] md:text-[19px]', editorial ? 'font-editorial' : 'font-display')}>{fTitle}</span>
        {f.price_label ? <span className="text-[13px] text-[#3D5A4E]">{f.price_label}</span>
          : featured && <Price amount={featured.price_min} from={featured.price_max > featured.price_min} size="sm" className="!text-[13px] !text-[#3D5A4E]" />}
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary transition-transform group-hover/feat:translate-x-1" aria-hidden><ArrowRight size={15} strokeWidth={1.4} /></span>
    </Link>
  );

  return (
    <section className={cn('relative overflow-hidden bg-primary text-primary-contrast md:grid md:min-h-[min(860px,100svh)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]', s.hide_on_mobile && 'max-md:hidden')} aria-label={s.heading?.replace(/\*/g, '') || 'Hero'}>
      {/* Picture: right half on desktop; full-bleed behind the text on phones */}
      <div className="relative h-[58svh] min-h-[360px] md:order-2 md:h-auto md:min-h-[520px]">
        {photo(m, cn(mm.url && 'max-md:hidden', 'saturate-[.92] contrast-[1.04]'), '(min-width:768px) 55vw, 100vw')}
        {mm.url && photo(mm, 'md:hidden', '100vw')}
        {/* emerald fades: from the text side on desktop, from the bottom on phones */}
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, var(--hg-primary) 0%, color-mix(in srgb, var(--hg-primary) 55%, transparent) 14%, transparent 38%)' }} />
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(0deg, color-mix(in srgb, var(--hg-primary) 55%, transparent) 0%, transparent 30%)' }} />
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--hg-primary) 70%, transparent) 82%, var(--hg-primary) 100%)' }} />
        {featureCard && <div className="absolute bottom-[clamp(16px,3vw,40px)] right-[clamp(16px,3vw,40px)] hidden max-w-[calc(100%-32px)] animate-fade-up [animation-delay:600ms] md:block">{featureCard}</div>}
      </div>

      {/* Copy */}
      <div className="relative z-10 -mt-16 flex flex-col gap-6 px-6 pb-12 md:order-1 md:mt-0 md:justify-center md:gap-7 md:px-[clamp(24px,6vw,96px)] md:py-24">
        {s.eyebrow && (
          <p className="flex items-center gap-3.5 text-[11px] uppercase tracking-[0.28em] text-accent animate-fade-up md:text-[12px]">
            <span className="h-px w-9 bg-accent" aria-hidden />{s.eyebrow}
          </p>
        )}
        {s.heading && (
          <h1 className={cn('text-balance leading-none tracking-[-0.015em] animate-fade-up [animation-delay:120ms]', editorial ? 'font-editorial text-[clamp(44px,6.2vw,92px)]' : 'display-1')}>
            {accentText(s.heading, 'text-accent')}
          </h1>
        )}
        {s.text && <p className="max-w-[440px] text-pretty text-[16px] leading-[1.6] text-primary-contrast/80 animate-fade-up [animation-delay:240ms] md:text-[17px]">{s.text}</p>}
        {Array.isArray(s.ctas) && s.ctas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-3 animate-fade-up [animation-delay:360ms]">
            {s.ctas.filter((c: S) => c?.href && c?.label).map((c: S, i: number) => (
              <Link key={i} href={c.href} className={cn('inline-flex h-[52px] items-center px-8 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors',
                (c.style ?? (i === 0 ? 'primary' : 'secondary')) === 'primary'
                  ? 'bg-accent text-primary hover:bg-[color-mix(in_srgb,var(--hg-accent)_88%,white)]'
                  : 'border border-accent/60 text-primary-contrast hover:border-accent hover:bg-primary-contrast/5')}>{c.label}</Link>
            ))}
          </div>
        )}
        {featureCard && <div className="mt-2 md:hidden">{featureCard}</div>}
        {trust.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-primary-contrast/15 pt-6 text-[13px] tracking-[0.04em] text-primary-contrast/65 animate-fade-up [animation-delay:480ms] md:mt-10">
            {trust.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

async function Hero({ s }: { s: S }) {
  if (s.layout === 'split') return HeroSplit({ s });
  const dark = s.theme !== 'light';
  const h = { tall: 'min-h-[88svh] md:min-h-[86vh]', medium: 'min-h-[62vh]', short: 'min-h-[44vh]' }[(s.height as string) || 'tall'];
  const align = { left: 'items-end md:items-center justify-start text-left', center: 'items-center justify-center text-center', right: 'items-end md:items-center justify-end text-left' }[(s.align as string) || 'left'];
  const m = s.media ?? {}; const mm = s.mobile_media ?? {};
  return (
    <section aria-label={s.heading?.replace(/\*/g, '') || 'Hero'} className={cn('relative flex overflow-hidden', h, dark ? 'bg-primary text-primary-contrast' : 'bg-panel text-ink', s.hide_on_mobile && 'max-md:hidden')}>
      <div className="absolute inset-0">
        {m.kind === 'video' && m.url ? <Video src={m.url} poster={m.poster} className={cn(mm.url && 'max-md:hidden')} />
          : m.url ? <Media src={m.url} alt={m.alt ?? ''} fill priority sizes="100vw" className={cn('animate-[fade-in_1.6s_ease]', mm.url && 'max-md:hidden')} /> : null}
        {mm.url && (mm.kind === 'video' ? <Video src={mm.url} poster={mm.poster} className="md:hidden" /> : <Media src={mm.url} alt={mm.alt ?? ''} fill priority sizes="100vw" className="md:hidden" />)}
        <div className="absolute inset-0" style={{ background: dark ? `linear-gradient(180deg, rgba(8,28,21,${(s.overlay ?? 0.25) * 0.5}) 0%, rgba(8,28,21,${s.overlay ?? 0.25}) 100%)` : `rgba(246,242,234,${s.overlay ?? 0})` }} />
      </div>
      <div className={cn('container-x relative z-10 flex w-full py-16 md:py-24', align)}>
        <div className={cn('max-w-[720px]', s.align === 'center' && 'mx-auto flex flex-col items-center')}>
          {s.eyebrow && <p className={cn('eyebrow animate-fade-up', dark && '!text-accent')}>{s.eyebrow}</p>}
          {s.heading && <h1 className="display-1 mt-5 animate-fade-up [animation-delay:120ms]">{accentText(s.heading, dark ? 'text-accent' : 'text-accent-strong')}</h1>}
          {s.text && <p className={cn('mt-6 max-w-xl text-[17px] leading-8 animate-fade-up [animation-delay:240ms]', dark ? 'text-primary-contrast/80' : 'text-muted')}>{s.text}</p>}
          {Array.isArray(s.ctas) && s.ctas.length > 0 && (
            <div className={cn('mt-9 flex flex-wrap gap-3 animate-fade-up [animation-delay:360ms]', s.align === 'center' && 'justify-center')}>
              {s.ctas.map((c: S, i: number) => <Cta key={i} cta={c} dark={dark} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryGrid({ s }: { s: S }) {
  const items: S[] = s.items ?? [];
  return (
    <Shell s={s}>
      <Heading s={s} />
      <div className={cn('grid gap-3 md:gap-5', items.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4')}>
        {items.map((it, i) => (
          <Reveal key={i} delay={i * 90}>
            <Link href={it.href || '#'} className="group relative block aspect-[3/4] overflow-hidden bg-panel">
              <Media src={it.image} alt={it.label} fill sizes="(min-width:1024px) 25vw, 50vw" className="zoom-on-hover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-primary-contrast md:p-6">
                <p className="font-display text-[24px] leading-tight md:text-[30px]">{it.label}</p>
                <p className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-90">Shop <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" /></p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}

async function resolveProducts(s: S) {
  const limit = Number(s.limit) || 8;
  if (s.source === 'manual' && Array.isArray(s.products)) return (await productsBySlugs(s.products)).slice(0, limit);
  if (s.source === 'category' && s.category) return (await listProducts({ category: s.category, sort: 'featured' })).items.slice(0, limit);
  if (s.source === 'collection' && s.collection) return (await listProducts({ collection: s.collection, sort: 'featured' })).items.slice(0, limit);
  if (s.source === 'new') return (await listProducts({ sort: 'newest' })).items.slice(0, limit);
  if (s.source === 'sale') return (await listProducts({ sale: true })).items.slice(0, limit);
  return (await listProducts({ sort: 'best_selling' })).items.slice(0, limit);
}

async function ProductCarousel({ s }: { s: S }) {
  const items = (await resolveProducts(s)).map(toCard);
  if (!items.length) return null;
  return (
    <Shell s={s}>
      <Heading s={s} />
      <ProductRail items={items} />
    </Shell>
  );
}

async function ProductGridSection({ s }: { s: S }) {
  const items = (await resolveProducts(s)).map(toCard);
  if (!items.length) return null;
  return (
    <Shell s={s}>
      <Heading s={s} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </Shell>
  );
}

function Editorial({ s }: { s: S }) {
  const dark = s.background === 'dark';
  const imgRight = s.layout === 'image-right';
  return (
    <Shell s={{ ...s, spacing: s.spacing ?? 'none' }} full>
      <div className="grid md:grid-cols-2">
        <Reveal variant="image" className={cn('relative min-h-[420px] md:min-h-[640px]', imgRight && 'md:order-2')}>
          <SectionMedia m={s.media} sizes="(min-width:768px) 50vw, 100vw" />
        </Reveal>
        <div className="flex items-center px-6 py-16 md:px-14 lg:px-24">
          <Reveal className="max-w-lg">
            {s.eyebrow && <p className={cn('eyebrow mb-4', dark && '!text-accent')}>{s.eyebrow}</p>}
            {s.heading && <h2 className="display-2">{s.heading}</h2>}
            {s.text && <p className={cn('mt-6 text-[17px] leading-8', dark ? 'text-primary-contrast/75' : 'text-muted')}>{s.text}</p>}
            {s.html && <div className="prose-hg mt-6" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html) }} />}
            <Cta cta={s.cta} dark={dark} className="mt-9" />
          </Reveal>
        </div>
      </div>
    </Shell>
  );
}

async function ShopTheLook({ s }: { s: S }) {
  const products = (await productsBySlugs(s.products ?? [])).map(toCard);
  return (
    <Shell s={s}>
      <div className="grid items-start gap-10 lg:grid-cols-12">
        <Reveal variant="image" className="relative aspect-[4/5] overflow-hidden bg-panel lg:col-span-7 lg:aspect-[16/12]">
          <SectionMedia m={s.media} sizes="(min-width:1024px) 58vw, 100vw" />
        </Reveal>
        <div className="lg:col-span-5">
          {s.eyebrow && <p className="eyebrow mb-3">{s.eyebrow}</p>}
          {s.heading && <h2 className="display-2">{s.heading}</h2>}
          {s.text && <p className="lede mt-4">{s.text}</p>}
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8">{products.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} sizes="20vw" />)}</div>
        </div>
      </div>
    </Shell>
  );
}

async function CollectionFeature({ s }: { s: S }) {
  const col = s.collection ? await getCollection(s.collection) : null;
  const img = s.media?.url || col?.image?.url;
  return (
    <section className={cn('relative overflow-hidden bg-primary text-primary-contrast', s.hide_on_mobile && 'max-md:hidden')}>
      <div className="grid min-h-[80vh] lg:grid-cols-2">
        <div className="relative min-h-[420px] lg:order-2"><SectionMedia m={s.media?.url ? s.media : img ? { url: img, kind: 'image' } : null} alt={s.media?.alt || col?.name || ''} sizes="(min-width:1024px) 50vw, 100vw" /></div>
        <div className="flex items-center px-6 py-20 md:px-14 lg:px-20">
          <Reveal className="max-w-xl">
            <p className="eyebrow !text-accent">{s.eyebrow || col?.name}</p>
            <h2 className="display-1 mt-5">{s.heading || col?.tagline}</h2>
            <div className="rule-gold my-8" />
            <p className="text-[17px] leading-8 text-primary-contrast/75">{s.text || col?.description}</p>
            {col?.deal_enabled && col.deal_price ? <p className="mt-6 text-[13px] uppercase tracking-[0.2em] text-accent">Complete collection offer available</p> : null}
            <Cta cta={s.cta ?? (col ? { label: 'Discover the collection', href: `/collections/${col.slug}` } : undefined)} dark className="mt-10" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ValueProps({ s }: { s: S }) {
  const items: S[] = s.items ?? [];
  const dark = s.background === 'dark';
  return (
    <Shell s={s}>
      <Heading s={s} center dark={dark} />
      <div className={cn('grid gap-10 text-center', items.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')}>
        {items.map((it, i) => {
          const Icon = ICONS[it.icon] ?? Sparkles;
          return (
            <Reveal key={i} delay={i * 90} className="flex flex-col items-center">
              <Icon size={26} strokeWidth={1.1} className={dark ? 'text-accent' : 'text-accent-strong'} />
              <h3 className="mt-5 font-display text-[24px]">{it.title}</h3>
              <p className={cn('mt-2 max-w-xs text-[14px] leading-6', dark ? 'text-primary-contrast/70' : 'text-muted')}>{it.text}</p>
            </Reveal>
          );
        })}
      </div>
    </Shell>
  );
}

function ProcessSteps({ s }: { s: S }) {
  const steps: S[] = s.steps ?? [];
  return (
    <Shell s={{ ...s, background: s.background ?? 'panel' }}>
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          {s.eyebrow && <p className="eyebrow mb-3">{s.eyebrow}</p>}
          <h2 className="display-2">{s.heading}</h2>
          {s.text && <p className="lede mt-5">{s.text}</p>}
          <ol className="mt-10 space-y-5">
            {steps.map((st, i) => (
              <Reveal as="li" key={i} delay={i * 80} className="flex gap-5 border-b border-line pb-5">
                <span className="font-display text-[28px] leading-none text-accent-strong">{String(i + 1).padStart(2, '0')}</span>
                <div><p className="font-display text-[22px] leading-tight">{st.title}</p><p className="mt-1 text-[14px] text-muted">{st.text}</p></div>
              </Reveal>
            ))}
          </ol>
          <Cta cta={s.cta} className="mt-10" />
        </div>
        <Reveal variant="image" className="relative aspect-[4/5] overflow-hidden lg:col-span-7 lg:aspect-[5/4]"><SectionMedia m={s.media} sizes="(min-width:1024px) 58vw, 100vw" /></Reveal>
      </div>
    </Shell>
  );
}

async function Reviews({ s }: { s: S }) {
  const reviews = await getFeaturedReviews(Number(s.limit) || 8);
  if (!reviews.length) return null;
  return (
    <Shell s={s}>
      <Heading s={s} center />
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {reviews.slice(0, 6).map((r, i) => (
          <Reveal key={r.id} delay={i * 80} className="w-[82%] shrink-0 snap-center border border-line bg-surface p-7 md:w-auto">
            <Stars value={r.rating} />
            {r.title && <p className="mt-4 font-display text-[22px] leading-snug">{r.title}</p>}
            <p className="mt-3 text-[15px] leading-7 text-muted">“{r.body}”</p>
            <p className="mt-5 text-[12px] uppercase tracking-[0.16em]">{r.author_name}{r.is_verified && <span className="ml-2 text-accent-strong">· Verified buyer</span>}</p>
            {r.product && <Link href={`/products/${r.product.slug}`} className="mt-1 block text-[12px] text-muted underline">{r.product.name}</Link>}
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}

async function SocialGallery({ s }: { s: S }) {
  const posts = await getSocialPosts();
  if (!posts.length) return null;
  const linked = await productsByIds([...new Set(posts.flatMap((p) => p.product_ids))]);
  return (
    <Shell s={s}>
      <Heading s={s} center />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {posts.slice(0, 8).map((p, i) => {
          const prod = linked.find((x) => p.product_ids.includes(x.id));
          const href = prod ? `/products/${prod.slug}` : p.permalink || '#';
          return (
            <Reveal key={p.id} delay={(i % 4) * 70}>
              <Link href={href} className="group relative block aspect-square overflow-hidden bg-panel" {...(!prod && p.permalink ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <Media src={p.media?.url ?? p.image_url} alt={p.caption ?? 'Hairver Green on Instagram'} fill sizes="25vw" className="zoom-on-hover" />
                {prod && <span className="absolute inset-x-0 bottom-0 translate-y-full bg-surface/95 px-3 py-2 text-[12px] transition-transform duration-500 group-hover:translate-y-0">Shop · {prod.name}</span>}
              </Link>
            </Reveal>
          );
        })}
      </div>
      {s.cta?.href && <div className="mt-10 text-center"><a href={s.cta.href} target="_blank" rel="noopener noreferrer" className="btn btn-outline">{s.cta.label}</a></div>}
    </Shell>
  );
}

async function Journal({ s }: { s: S }) {
  const posts = await getPosts({ limit: Number(s.limit) || 3 });
  if (!posts.length) return null;
  return (
    <Shell s={s}>
      <Heading s={s} />
      <div className="grid gap-10 md:grid-cols-3">
        {posts.map((p, i) => (
          <Reveal key={p.id} delay={i * 90}>
            <Link href={`/journal/${p.slug}`} className="group block">
              <div className="relative aspect-[3/2] overflow-hidden bg-panel"><Media src={p.featured_image?.url} alt={p.featured_image?.alt ?? p.title} fill sizes="33vw" className="zoom-on-hover" /></div>
              <p className="eyebrow mt-5">{p.category?.name}{p.published_at && ` · ${formatDate(p.published_at)}`}</p>
              <h3 className="mt-2 font-display text-[26px] leading-tight">{p.title}</h3>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-[14px] text-muted">{p.excerpt}</p>}
            </Link>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}

function Newsletter({ s }: { s: S }) {
  const dark = s.theme !== 'light';
  return (
    <section className={cn(dark ? 'bg-primary text-primary-contrast' : 'bg-panel', 'py-20 md:py-28', s.hide_on_mobile && 'max-md:hidden')}>
      <Reveal className="container-x flex flex-col items-center text-center">
        <p className={cn('eyebrow', dark && '!text-accent')}>{s.eyebrow || 'The list'}</p>
        <h2 className="display-2 mt-4 max-w-2xl">{s.heading}</h2>
        {s.text && <p className={cn('mt-4 max-w-xl text-[16px]', dark ? 'text-primary-contrast/75' : 'text-muted')}>{s.text}</p>}
        <div className="mt-8 w-full max-w-md text-left"><NewsletterForm dark={dark} source="section" /></div>
      </Reveal>
    </section>
  );
}

function RichText({ s }: { s: S }) {
  return (
    <Shell s={s}>
      <Reveal className={cn('mx-auto', s.width === 'wide' ? 'max-w-5xl' : 'max-w-3xl', s.align === 'center' && 'text-center')}>
        {s.heading && <h2 className="display-3 mb-6">{s.heading}</h2>}
        <div className="prose-hg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html || '') }} />
      </Reveal>
    </Shell>
  );
}

function FullImage({ s }: { s: S }) {
  const inner = (
    <div className={cn('relative w-full overflow-hidden', s.aspect === 'tall' ? 'aspect-[4/5] md:aspect-[16/9]' : 'aspect-[16/10] md:aspect-[21/9]')}>
      <SectionMedia m={s.media} sizes="100vw" />
      {(s.heading || s.text) && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent">
          <div className="container-x pb-10 text-primary-contrast md:pb-16"><h2 className="display-2 max-w-2xl">{s.heading}</h2>{s.text && <p className="mt-3 max-w-xl opacity-85">{s.text}</p>}<Cta cta={s.cta} dark className="mt-6" /></div>
        </div>
      )}
    </div>
  );
  return <Shell s={{ ...s, spacing: s.spacing ?? 'none' }} full>{s.link ? <Link href={s.link}>{inner}</Link> : inner}</Shell>;
}

function Banner({ s }: { s: S }) {
  const dark = s.theme !== 'light';
  return (
    <Shell s={{ ...s, spacing: s.spacing ?? 'sm' }}>
      <Reveal className={cn('relative flex flex-col items-center gap-5 overflow-hidden px-6 py-12 text-center md:flex-row md:justify-between md:px-14 md:text-left', dark ? 'bg-primary text-primary-contrast' : 'bg-panel')}>
        {s.media?.url && <div className="absolute inset-0 opacity-25"><SectionMedia m={s.media} alt="" sizes="100vw" /></div>}
        <div className="relative">
          {s.eyebrow && <p className={cn('eyebrow', dark && '!text-accent')}>{s.eyebrow}</p>}
          <p className="mt-2 font-display text-[30px] leading-tight md:text-[40px]">{s.heading}</p>
          {s.text && <p className={cn('mt-2', dark ? 'text-primary-contrast/75' : 'text-muted')}>{s.text}</p>}
        </div>
        <div className="relative flex flex-col items-center gap-4 md:items-end">
          {s.ends_at && <Countdown to={s.ends_at} dark={dark} />}
          <Cta cta={s.cta} dark={dark} />
        </div>
      </Reveal>
    </Shell>
  );
}

function CountdownSection({ s }: { s: S }) {
  if (!s.ends_at || new Date(s.ends_at).getTime() < Date.now()) return null;
  return (
    <Shell s={{ ...s, background: s.background ?? 'dark' }}>
      <Reveal className="flex flex-col items-center text-center">
        {s.eyebrow && <p className="eyebrow !text-accent">{s.eyebrow}</p>}
        <h2 className="display-2 mt-3">{s.heading}</h2>
        <div className="mt-8"><Countdown to={s.ends_at} dark large /></div>
        <Cta cta={s.cta} dark className="mt-8" />
      </Reveal>
    </Shell>
  );
}

function Faq({ s }: { s: S }) {
  return (
    <Shell s={s}>
      <div className="mx-auto max-w-3xl">
        <Heading s={s} center />
        <Accordion items={(s.items ?? []).map((it: S) => ({ title: it.q, content: <p>{it.a}</p> }))} />
      </div>
    </Shell>
  );
}

function CtaSection({ s }: { s: S }) {
  const dark = s.background === 'dark';
  return (
    <Shell s={s}>
      <Reveal className="flex flex-col items-center text-center">
        {s.eyebrow && <p className={cn('eyebrow', dark && '!text-accent')}>{s.eyebrow}</p>}
        <h2 className="display-2 mt-3 max-w-3xl">{s.heading}</h2>
        {s.text && <p className={cn('lede mt-4 max-w-2xl', dark && '!text-primary-contrast/75')}>{s.text}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">{(s.ctas ?? (s.cta ? [s.cta] : [])).map((c: S, i: number) => <Cta key={i} cta={c} dark={dark} />)}</div>
      </Reveal>
    </Shell>
  );
}

function TrustBadges({ s }: { s: S }) {
  const items: S[] = s.items ?? [];
  return (
    <Shell s={{ ...s, spacing: s.spacing ?? 'sm', background: s.background ?? 'panel' }}>
      <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {items.map((it, i) => { const Icon = ICONS[it.icon] ?? ShieldCheck; return (
          <li key={i} className="flex items-center gap-3"><Icon size={22} strokeWidth={1.2} className="shrink-0 text-accent-strong" /><div><p className="text-[13px] font-medium uppercase tracking-[0.14em]">{it.title}</p>{it.text && <p className="text-[13px] text-muted">{it.text}</p>}</div></li>
        ); })}
      </ul>
    </Shell>
  );
}

function LogoStrip({ s }: { s: S }) {
  const items: S[] = s.items ?? [];
  return (
    <Shell s={{ ...s, spacing: s.spacing ?? 'sm' }}>
      {s.heading && <p className="eyebrow mb-6 text-center">{s.heading}</p>}
      <div className="flex flex-wrap items-center justify-center gap-10 opacity-70">
        {items.map((it, i) => it.image ? <Media key={i} src={it.image} alt={it.label ?? ''} width={140} height={48} className="h-10 w-auto object-contain" /> : <span key={i} className="font-display text-2xl">{it.label}</span>)}
      </div>
    </Shell>
  );
}

async function TextureGuide({ s }: { s: S }) {
  const textures = (await getAttributes()).filter((a) => a.attribute === 'texture');
  return (
    <Shell s={s}>
      <Heading s={s} center />
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
        {textures.map((t, i) => (
          <Reveal key={t.id} delay={(i % 3) * 80}>
            <Link href={`/shop?texture=${t.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-panel"><Media src={`/demo/${t.slug}-1.svg`} alt={`${t.label} texture`} fill sizes="33vw" className="zoom-on-hover" /></div>
              <h3 className="mt-4 font-display text-[26px]">{t.label}</h3>
              {t.description && <p className="mt-1 text-[14px] text-muted">{t.description}</p>}
            </Link>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}

function LengthGuide({ s }: { s: S }) {
  const rows = [['10"–12"', 'Chin to jaw', 'Bob and lob styles'], ['14"–16"', 'Shoulder length', 'Everyday, low-maintenance'], ['18"–20"', 'Just below the shoulder blades', 'Our most popular lengths'], ['22"–24"', 'Mid-back', 'Glamorous, full movement'], ['26"–30"', 'Waist length', 'Statement length — choose higher density']];
  return (
    <Shell s={s}>
      <div id="length-guide" className="mx-auto max-w-4xl">
        <Heading s={s} center />
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">Hair length guide</caption>
          <thead><tr className="border-b border-ink/40"><th className="py-3 caps">Length</th><th className="py-3 caps">Falls at</th><th className="py-3 caps">Best for</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]} className="border-b border-line"><td className="py-4 font-display text-[20px]">{r[0]}</td><td className="py-4 text-muted">{r[1]}</td><td className="py-4 text-muted">{r[2]}</td></tr>)}</tbody>
        </table>
        <p className="mt-4 text-[13px] text-muted">Wavy and curly textures sit shorter than their stretched length. If you&apos;re between lengths, go longer.</p>
      </div>
    </Shell>
  );
}

function ImageSection({ s }: { s: S }) {
  return (
    <Shell s={s}>
      <figure className={cn('mx-auto', s.width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl')}>
        <div className="relative aspect-[16/10] overflow-hidden bg-panel"><SectionMedia m={s.media} sizes="(min-width:1024px) 80vw, 100vw" /></div>
        {s.caption && <figcaption className="mt-3 text-center text-[13px] text-muted">{s.caption}</figcaption>}
      </figure>
    </Shell>
  );
}

function VideoSection({ s }: { s: S }) {
  return (
    <Shell s={s}>
      <Heading s={s} center />
      <div className="mx-auto aspect-video max-w-5xl overflow-hidden bg-panel">
        {s.media?.url && <video src={s.media.poster ? s.media.url : `${s.media.url}#t=0.1`} poster={s.media.poster ?? undefined} controls playsInline preload="metadata" className="h-full w-full object-cover" />}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
const REGISTRY: Record<string, (p: { s: S }) => React.ReactNode | Promise<React.ReactNode>> = {
  hero: Hero, category_grid: CategoryGrid, product_carousel: ProductCarousel, product_grid: ProductGridSection, editorial: Editorial,
  split: Editorial, shop_the_look: ShopTheLook, collection_feature: CollectionFeature, value_props: ValueProps, process_steps: ProcessSteps,
  reviews: Reviews, testimonials: Reviews, social_gallery: SocialGallery, journal: Journal, newsletter: Newsletter, rich_text: RichText,
  text: RichText, full_width_image: FullImage, banner: Banner, promo_banner: Banner, countdown: CountdownSection, faq: Faq, cta: CtaSection,
  trust_badges: TrustBadges, logo_strip: LogoStrip, texture_guide: TextureGuide, length_guide: LengthGuide, image: ImageSection, video: VideoSection,
  collection: ProductGridSection,
};

export const SECTION_TYPES = Object.keys(REGISTRY);

/** Section videos saved without a thumbnail pick up the one stored in the media library. */
async function withVideoPosters(sections: PageSection[]): Promise<PageSection[]> {
  const urls = new Set<string>();
  for (const sec of sections) for (const k of ['media', 'mobile_media']) {
    const m = (sec.settings as S | null)?.[k];
    if (m?.kind === 'video' && m.url && !m.poster) urls.add(m.url);
  }
  if (!urls.size) return sections;
  const { data } = await supabasePublic().from('media').select('url, metadata').in('url', [...urls]);
  const poster = new Map((data ?? []).map((r: { url: string; metadata: { poster?: string } | null }) => [r.url, r.metadata?.poster ?? null]));
  return sections.map((sec) => {
    const st: S = { ...(sec.settings ?? {}) };
    for (const k of ['media', 'mobile_media']) if (st[k]?.kind === 'video' && !st[k].poster && poster.get(st[k].url)) st[k] = { ...st[k], poster: poster.get(st[k].url) };
    return { ...sec, settings: st };
  });
}

export async function SectionRenderer({ sections: raw }: { sections: PageSection[] }) {
  const sections = await withVideoPosters(raw);
  return (
    <>
      {sections.filter((x) => x.is_visible).map((sec) => {
        const C = REGISTRY[sec.type];
        if (!C) return null;
        return <C key={sec.id} s={sec.settings ?? {}} />;
      })}
    </>
  );
}
