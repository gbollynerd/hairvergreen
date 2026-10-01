// Field definitions for the page builder. Client-safe (no server imports).
// Each section type lists the settings it understands; anything else can be edited in the JSON tab.

export type SField =
  | { key: string; label: string; type: 'text' | 'textarea' | 'html' | 'url' | 'number' | 'datetime'; hint?: string; placeholder?: string }
  | { key: string; label: string; type: 'select'; options: [string, string][]; hint?: string }
  | { key: string; label: string; type: 'toggle'; hint?: string }
  | { key: string; label: string; type: 'media'; kind?: 'image' | 'video'; hint?: string }
  | { key: string; label: string; type: 'cta'; hint?: string }
  | { key: string; label: string; type: 'ctas'; hint?: string }
  | { key: string; label: string; type: 'tags'; hint?: string; placeholder?: string }
  | { key: string; label: string; type: 'collection' | 'category'; hint?: string }
  | { key: string; label: string; type: 'list'; fields: { key: string; label: string; type?: 'text' | 'textarea' | 'media' | 'select' | 'number'; options?: [string, string][]; wide?: boolean }[]; addLabel?: string; hint?: string };

const HEAD: SField[] = [
  { key: 'eyebrow', label: 'Eyebrow', type: 'text', placeholder: 'Small caps line above the heading' },
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'text', label: 'Text', type: 'textarea' },
];
const BG: SField = { key: 'background', label: 'Background', type: 'select', options: [['default', 'Page background'], ['surface', 'White'], ['panel', 'Parchment'], ['dark', 'Emerald']] };
const SPACING: SField = { key: 'spacing', label: 'Spacing', type: 'select', options: [['md', 'Medium'], ['sm', 'Small'], ['lg', 'Large'], ['none', 'None']] };
const THEME: SField = { key: 'theme', label: 'Colour theme', type: 'select', options: [['dark', 'Dark (emerald)'], ['light', 'Light (parchment)']] };
const CTA: SField = { key: 'cta', label: 'Button', type: 'cta' };
const ICONS: [string, string][] = [['sparkle', 'Sparkle'], ['scissors', 'Scissors'], ['globe', 'Globe'], ['heart', 'Heart'], ['shield', 'Shield'], ['truck', 'Truck'], ['gem', 'Gem'], ['clock', 'Clock'], ['award', 'Award'], ['star', 'Star']];
const SOURCE: SField = { key: 'source', label: 'Products from', type: 'select', options: [['best', 'Best sellers'], ['new', 'Newest'], ['sale', 'On sale'], ['collection', 'A collection'], ['category', 'A category'], ['manual', 'Hand-picked']] };
const PRODUCT_PICK: SField[] = [
  SOURCE,
  { key: 'collection', label: 'Collection', type: 'collection', hint: 'Used when “A collection” is selected' },
  { key: 'category', label: 'Category', type: 'category', hint: 'Used when “A category” is selected' },
  { key: 'products', label: 'Hand-picked products', type: 'tags', placeholder: 'product-slug, press Enter', hint: 'Product URL slugs, in order' },
  { key: 'limit', label: 'How many', type: 'number' },
];

export const SECTION_SCHEMA: Record<string, { label: string; description: string; fields: SField[]; defaults: Record<string, unknown> }> = {
  hero: {
    label: 'Hero banner', description: 'Full-bleed image or video with heading and buttons.',
    fields: [
      { key: 'layout', label: 'Layout', type: 'select', options: [['overlay', 'Text over full-width image'], ['split', 'Split — text panel left, photo right']] },
      HEAD[0], { key: 'heading', label: 'Heading', type: 'text', hint: 'Wrap words in *asterisks* to set them in gold italic, e.g. Luxury hair. *Beautifully* yours.' }, HEAD[2],
      { key: 'media', label: 'Image or video', type: 'media' }, { key: 'mobile_media', label: 'Mobile image (optional)', type: 'media' },
      { key: 'focal', label: 'Photo focus point (split layout)', type: 'text', placeholder: '50% 20%', hint: 'Horizontal and vertical position to keep in frame when the photo is cropped' },
      { key: 'ctas', label: 'Buttons', type: 'ctas' },
      { key: 'font', label: 'Heading font (split layout)', type: 'select', options: [['editorial', 'Bodoni Moda (editorial)'], ['display', 'Brand display font']] },
      { key: 'trust', label: 'Trust points (split layout)', type: 'list', addLabel: 'Add point', fields: [{ key: 'text', label: 'Text', wide: true }] },
      { key: 'feature_product', label: 'Featured product card — product URL slug', type: 'text', placeholder: 'burmese-curly', hint: 'Shows the product name and price on the photo (split layout). Leave empty to hide.' },
      { key: 'feature_eyebrow', label: 'Featured card label', type: 'text', placeholder: 'Worn here · New' },
      { key: 'feature_title', label: 'Featured card title (optional override)', type: 'text' },
      { key: 'feature_price_label', label: 'Featured card price text (optional override)', type: 'text', placeholder: 'From ₦95,000' },
      { key: 'align', label: 'Text alignment (overlay layout)', type: 'select', options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] },
      { key: 'height', label: 'Height (overlay layout)', type: 'select', options: [['tall', 'Tall'], ['medium', 'Medium'], ['short', 'Short']] },
      { key: 'overlay', label: 'Image darkening, 0–0.8 (overlay layout)', type: 'number' }, THEME],
    defaults: { heading: 'New hero', align: 'left', height: 'tall', overlay: 0.25, theme: 'dark', ctas: [] },
  },
  category_grid: {
    label: 'Category tiles', description: 'Image tiles linking to categories or pages.',
    fields: [...HEAD.slice(0, 2), { key: 'items', label: 'Tiles', type: 'list', addLabel: 'Add tile', fields: [{ key: 'label', label: 'Label' }, { key: 'href', label: 'Link' }, { key: 'image', label: 'Image', type: 'media', wide: true }] },
      { key: 'layout', label: 'Layout', type: 'select', options: [['grid-4', '4 across'], ['grid-3', '3 across'], ['grid-2', '2 across']] }, BG],
    defaults: { heading: 'Shop by category', items: [], layout: 'grid-4' },
  },
  product_carousel: { label: 'Product carousel', description: 'A scrolling row of products.', fields: [...HEAD.slice(0, 2), ...PRODUCT_PICK, CTA, BG], defaults: { heading: 'Best sellers', source: 'best', limit: 8 } },
  product_grid: { label: 'Product grid', description: 'A grid of products.', fields: [...HEAD.slice(0, 2), ...PRODUCT_PICK, CTA, BG], defaults: { heading: 'Shop the edit', source: 'new', limit: 8 } },
  editorial: {
    label: 'Image with text', description: 'Editorial split: image on one side, story on the other.',
    fields: [...HEAD, { key: 'media', label: 'Image or video', type: 'media' }, CTA, { key: 'layout', label: 'Image side', type: 'select', options: [['image-left', 'Left'], ['image-right', 'Right']] }, BG, SPACING],
    defaults: { heading: 'Our story', layout: 'image-left', background: 'panel' },
  },
  shop_the_look: { label: 'Shop the look', description: 'Editorial image with the products in it.', fields: [...HEAD, { key: 'media', label: 'Image', type: 'media' }, { key: 'products', label: 'Products', type: 'tags', placeholder: 'product-slug, press Enter' }, BG], defaults: { heading: 'Shop the look', products: [] } },
  collection_feature: { label: 'Featured collection', description: 'Spotlight a collection with image and products.', fields: [...HEAD, { key: 'collection', label: 'Collection', type: 'collection' }, { key: 'media', label: 'Image', type: 'media' }, CTA, THEME], defaults: { heading: 'The Signature Collection', theme: 'dark' } },
  value_props: { label: 'Value propositions', description: 'Icons with short promises.', fields: [...HEAD.slice(0, 2), { key: 'items', label: 'Items', type: 'list', addLabel: 'Add item', fields: [{ key: 'title', label: 'Title' }, { key: 'icon', label: 'Icon', type: 'select', options: ICONS }, { key: 'text', label: 'Text', type: 'textarea' }] }, BG], defaults: { heading: 'Why Hairver Green', items: [] } },
  process_steps: { label: 'Process steps', description: 'Numbered steps, e.g. the custom unit journey.', fields: [...HEAD, { key: 'steps', label: 'Steps', type: 'list', addLabel: 'Add step', fields: [{ key: 'title', label: 'Title' }, { key: 'text', label: 'Text', type: 'textarea' }] }, { key: 'media', label: 'Image', type: 'media' }, CTA, BG], defaults: { heading: 'How it works', steps: [] } },
  reviews: { label: 'Customer reviews', description: 'Featured approved reviews.', fields: [...HEAD.slice(0, 2), { key: 'limit', label: 'How many', type: 'number' }, BG], defaults: { heading: 'In their words', limit: 6 } },
  social_gallery: { label: 'Social gallery', description: 'Posts from the Social gallery manager.', fields: [...HEAD.slice(0, 2), CTA, BG], defaults: { heading: 'Follow along', eyebrow: '@hairvergreen' } },
  journal: { label: 'Journal posts', description: 'Latest Hair Journal posts.', fields: [...HEAD.slice(0, 2), { key: 'limit', label: 'How many', type: 'number' }, CTA, BG], defaults: { heading: 'The Hair Journal', limit: 3 } },
  newsletter: { label: 'Newsletter signup', description: 'Email signup block.', fields: [...HEAD.slice(1), THEME], defaults: { heading: 'Be the first to know.', theme: 'dark' } },
  rich_text: { label: 'Rich text', description: 'Formatted text — stories, policies, notes.', fields: [{ key: 'heading', label: 'Heading', type: 'text' }, { key: 'html', label: 'Content', type: 'html' }, { key: 'width', label: 'Width', type: 'select', options: [['narrow', 'Narrow'], ['wide', 'Wide']] }, { key: 'align', label: 'Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Centre']] }, BG, SPACING], defaults: { html: '<p>Write something beautiful.</p>', width: 'narrow' } },
  full_width_image: { label: 'Full-width image', description: 'Edge-to-edge image or video with optional caption.', fields: [{ key: 'media', label: 'Image or video', type: 'media' }, { key: 'heading', label: 'Overlay heading', type: 'text' }, { key: 'text', label: 'Overlay text', type: 'textarea' }, CTA, { key: 'link', label: 'Link whole image to', type: 'url' }, { key: 'aspect', label: 'Shape', type: 'select', options: [['wide', 'Wide'], ['tall', 'Tall']] }], defaults: { aspect: 'wide' } },
  image: { label: 'Image', description: 'A single contained image with caption.', fields: [{ key: 'media', label: 'Image', type: 'media', kind: 'image' }, { key: 'caption', label: 'Caption', type: 'text' }, { key: 'width', label: 'Width', type: 'select', options: [['wide', 'Wide'], ['narrow', 'Narrow']] }, BG], defaults: {} },
  video: { label: 'Video', description: 'An uploaded video with controls.', fields: [...HEAD.slice(0, 2), { key: 'media', label: 'Video', type: 'media', kind: 'video' }, BG], defaults: {} },
  banner: { label: 'Promo banner', description: 'Compact promotional strip with optional countdown.', fields: [...HEAD, CTA, { key: 'ends_at', label: 'Countdown to (optional)', type: 'datetime' }, { key: 'media', label: 'Background image', type: 'media', kind: 'image' }, THEME, SPACING], defaults: { heading: 'Limited offer', theme: 'dark' } },
  countdown: { label: 'Countdown', description: 'Large timer for launches and sales. Hidden automatically once it ends.', fields: [...HEAD.slice(0, 2), { key: 'ends_at', label: 'Ends at', type: 'datetime' }, CTA, BG], defaults: { heading: 'The drop opens in', background: 'dark' } },
  faq: { label: 'FAQ', description: 'Questions and answers in an accordion.', fields: [...HEAD.slice(0, 2), { key: 'items', label: 'Questions', type: 'list', addLabel: 'Add question', fields: [{ key: 'q', label: 'Question', wide: true }, { key: 'a', label: 'Answer', type: 'textarea' }] }, BG], defaults: { heading: 'Frequently asked questions', items: [] } },
  cta: { label: 'Call to action', description: 'Centred heading with buttons.', fields: [...HEAD, { key: 'ctas', label: 'Buttons', type: 'ctas' }, BG, SPACING], defaults: { heading: 'Ready when you are.', background: 'dark', ctas: [] } },
  trust_badges: { label: 'Trust badges', description: 'Small icons with short service promises.', fields: [{ key: 'items', label: 'Badges', type: 'list', addLabel: 'Add badge', fields: [{ key: 'title', label: 'Title' }, { key: 'icon', label: 'Icon', type: 'select', options: ICONS }, { key: 'text', label: 'Text', type: 'textarea' }] }, BG, SPACING], defaults: { items: [] } },
  logo_strip: { label: 'Logo strip', description: 'Press or partner logos.', fields: [{ key: 'heading', label: 'Heading', type: 'text' }, { key: 'items', label: 'Logos', type: 'list', addLabel: 'Add logo', fields: [{ key: 'label', label: 'Name' }, { key: 'image', label: 'Logo', type: 'media' }] }, BG, SPACING], defaults: { items: [] } },
  texture_guide: { label: 'Texture guide', description: 'Auto-built from your texture attributes.', fields: [...HEAD.slice(0, 2), BG], defaults: { heading: 'Texture guide' } },
  length_guide: { label: 'Length guide', description: 'Length chart with guidance.', fields: [...HEAD.slice(1), BG], defaults: { heading: 'Length guide' } },
};

export const COMMON_FIELDS: SField[] = [
  { key: 'hide_on_mobile', label: 'Hide on mobile', type: 'toggle' },
  { key: 'hide_on_desktop', label: 'Hide on desktop', type: 'toggle' },
];

export const SECTION_OPTIONS = Object.entries(SECTION_SCHEMA).map(([k, v]) => ({ type: k, label: v.label, description: v.description }));

export const pageUrl = (p: { slug: string; kind: string }) => (p.kind === 'home' ? '/' : p.kind === 'policy' ? `/policies/${p.slug}` : `/${p.slug}`);
