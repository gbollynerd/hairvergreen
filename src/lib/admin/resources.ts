// Declarative admin resources. Each entry drives a list page, an edit form, validation and saving,
// so simple content types don't need bespoke screens. Shared by server and client (no secrets here).

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'boolean' | 'select' | 'multiselect' | 'date' | 'datetime'
  | 'media' | 'mediaId' | 'tags' | 'list' | 'richtext' | 'color' | 'slug' | 'json' | 'readonly' | 'emails';

export type OptionSource = 'categories' | 'collections' | 'products' | 'shipping_zones' | 'campaigns' | 'pages' | 'popups' | 'blog_categories' | 'countries' | 'staff';

export type FieldDef = {
  name: string; label: string; type: FieldType; required?: boolean; hint?: string; span?: 1 | 2; placeholder?: string;
  options?: [string, string][]; optionsFrom?: OptionSource; slugFrom?: string; showIf?: { field: string; in: string[] };
  listFields?: { key: string; label: string; type?: 'text' | 'textarea' | 'media' | 'select' | 'number'; options?: [string, string][] }[];
  section?: string; default?: unknown;
};

export type ColumnDef = { name: string; label: string; format?: 'money' | 'date' | 'datetime' | 'boolean' | 'badge' | 'image' | 'percent' | 'list' | 'count' | 'discount' };

export type ResourceDef = {
  key: string; table: string; title: string; singular: string; description?: string;
  permission: string | string[]; createPermission?: string; deletePermission?: string;
  fields: FieldDef[]; columns: ColumnDef[]; orderBy: [string, boolean][]; searchable?: string[];
  refresh?: 'catalog' | 'content' | 'all' | null; titleField: string; filters?: { name: string; label: string; options: [string, string][] }[];
  readonly?: boolean; noCreate?: boolean; select?: string;
};

const STATUS_BOOL = [['true', 'Yes'], ['false', 'No']] as [string, string][];
void STATUS_BOOL;

export const RESOURCES: Record<string, ResourceDef> = {
  discounts: {
    key: 'discounts', table: 'discounts', title: 'Discounts & coupons', singular: 'discount', titleField: 'name',
    description: 'Coupon codes and automatic promotions. Leave the code empty for an automatic promotion.',
    permission: ['coupons.edit', 'coupons.create'], createPermission: 'coupons.create', deletePermission: 'coupons.delete', refresh: 'catalog',
    orderBy: [['created_at', false]], searchable: ['name', 'code'],
    columns: [{ name: 'name', label: 'Name' }, { name: 'code', label: 'Code' }, { name: 'kind', label: 'Type', format: 'badge' }, { name: 'value', label: 'Value', format: 'discount' },
      { name: 'used_count', label: 'Used' }, { name: 'ends_at', label: 'Ends', format: 'datetime' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    filters: [{ name: 'kind', label: 'Type', options: [['percentage', 'Percentage'], ['fixed', 'Fixed amount'], ['free_shipping', 'Free shipping'], ['buy_x_get_y', 'Buy X get Y'], ['tiered', 'Buy more save more']] }],
    fields: [
      { name: 'name', label: 'Internal name', type: 'text', required: true, section: 'Discount' },
      { name: 'code', label: 'Coupon code', type: 'text', hint: 'Customers type this at checkout. Leave empty to apply automatically.', placeholder: 'WELCOME10' },
      { name: 'description', label: 'Description', type: 'text', span: 2 },
      { name: 'kind', label: 'Type', type: 'select', required: true, options: [['percentage', 'Percentage off'], ['fixed', 'Fixed amount off (₦)'], ['free_shipping', 'Free shipping'], ['buy_x_get_y', 'Buy X, get Y'], ['tiered', 'Buy more, save more (tiers)']] },
      { name: 'value', label: 'Value', type: 'number', hint: 'Percent (e.g. 10) or naira amount (e.g. 5000) depending on type.', showIf: { field: 'kind', in: ['percentage', 'fixed'] } },
      { name: 'applies_to', label: 'Applies to', type: 'select', options: [['order', 'Entire order'], ['products', 'Specific products'], ['categories', 'Specific categories'], ['collections', 'Specific collections']], section: 'Targeting' },
      { name: 'target_products', label: 'Products', type: 'multiselect', optionsFrom: 'products', showIf: { field: 'applies_to', in: ['products'] } },
      { name: 'target_categories', label: 'Categories', type: 'multiselect', optionsFrom: 'categories', showIf: { field: 'applies_to', in: ['categories'] } },
      { name: 'target_collections', label: 'Collections', type: 'multiselect', optionsFrom: 'collections', showIf: { field: 'applies_to', in: ['collections'] } },
      { name: 'buy_quantity', label: 'Buy (quantity)', type: 'number', showIf: { field: 'kind', in: ['buy_x_get_y'] } },
      { name: 'get_quantity', label: 'Get (quantity)', type: 'number', showIf: { field: 'kind', in: ['buy_x_get_y'] } },
      { name: 'get_percent', label: 'At % off (100 = free)', type: 'number', showIf: { field: 'kind', in: ['buy_x_get_y'] } },
      { name: 'tiers', label: 'Tiers', type: 'list', showIf: { field: 'kind', in: ['tiered'] }, listFields: [{ key: 'min_qty', label: 'Minimum quantity', type: 'number' }, { key: 'percent', label: '% off', type: 'number' }], span: 2 },
      { name: 'min_subtotal', label: 'Minimum spend', type: 'money', section: 'Restrictions' },
      { name: 'max_discount', label: 'Maximum discount', type: 'money' },
      { name: 'min_quantity', label: 'Minimum items', type: 'number' },
      { name: 'eligibility', label: 'Customers', type: 'select', options: [['all', 'Everyone'], ['new', 'New customers (first order)'], ['existing', 'Returning customers'], ['specific', 'Specific emails']] },
      { name: 'customer_emails', label: 'Customer emails', type: 'emails', showIf: { field: 'eligibility', in: ['specific'] }, span: 2 },
      { name: 'usage_limit', label: 'Total uses allowed', type: 'number' },
      { name: 'per_customer_limit', label: 'Uses per customer', type: 'number' },
      { name: 'countries', label: 'Countries (ISO codes)', type: 'tags', hint: 'Empty = all countries. e.g. NG, GB' },
      { name: 'currencies', label: 'Currencies', type: 'tags', hint: 'Empty = all.' },
      { name: 'starts_at', label: 'Starts', type: 'datetime', section: 'Schedule' },
      { name: 'ends_at', label: 'Ends', type: 'datetime' },
      { name: 'is_flash_sale', label: 'Flash sale', type: 'boolean' },
      { name: 'show_countdown', label: 'Show countdown', type: 'boolean' },
      { name: 'combinable', label: 'Can combine with other codes', type: 'boolean' },
      { name: 'campaign_id', label: 'Campaign', type: 'select', optionsFrom: 'campaigns' },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
      { name: 'used_count', label: 'Times used', type: 'readonly' },
    ],
  },
  campaigns: {
    key: 'campaigns', table: 'campaigns', title: 'Campaigns', singular: 'campaign', titleField: 'name', permission: 'campaigns.manage', refresh: 'all',
    description: 'Group a banner, products, discounts, landing page and popup under one sale (e.g. Black Friday).',
    orderBy: [['starts_at', false]], searchable: ['name'],
    columns: [{ name: 'name', label: 'Campaign' }, { name: 'status', label: 'Status', format: 'badge' }, { name: 'starts_at', label: 'Starts', format: 'datetime' }, { name: 'ends_at', label: 'Ends', format: 'datetime' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'description', label: 'Description', type: 'textarea', span: 2 },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['scheduled', 'Scheduled'], ['active', 'Active'], ['ended', 'Ended']] },
      { name: 'banner_id', label: 'Banner image', type: 'mediaId' },
      { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' },
      { name: 'product_ids', label: 'Products', type: 'multiselect', optionsFrom: 'products', span: 2 },
      { name: 'landing_page_id', label: 'Landing page', type: 'select', optionsFrom: 'pages' }, { name: 'popup_id', label: 'Popup', type: 'select', optionsFrom: 'popups' },
      { name: 'email_campaign_ref', label: 'Email campaign reference', type: 'text', hint: 'ID in your email platform, for tracking.' },
    ],
  },
  popups: {
    key: 'popups', table: 'popups', title: 'Popups', singular: 'popup', titleField: 'name', permission: 'popups.manage', refresh: 'content',
    description: 'Welcome offers, newsletter capture, exit intent and campaign popups. Frequency controls keep them polite.',
    orderBy: [['priority', false]], searchable: ['name', 'title'],
    columns: [{ name: 'name', label: 'Name' }, { name: 'kind', label: 'Type', format: 'badge' }, { name: 'trigger', label: 'Trigger' }, { name: 'audience', label: 'Audience' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    fields: [
      { name: 'name', label: 'Internal name', type: 'text', required: true, section: 'Content' },
      { name: 'kind', label: 'Type', type: 'select', options: [['welcome', 'Welcome'], ['newsletter', 'Newsletter'], ['exit_intent', 'Exit intent'], ['promotion', 'Product promotion'], ['flash_sale', 'Flash sale'], ['free_shipping', 'Free shipping'], ['campaign', 'Campaign']] },
      { name: 'title', label: 'Heading', type: 'text', required: true, span: 2 }, { name: 'body', label: 'Text', type: 'textarea', span: 2 },
      { name: 'image_id', label: 'Image', type: 'mediaId' },
      { name: 'collect_email', label: 'Collect email address', type: 'boolean', default: true },
      { name: 'coupon_code', label: 'Coupon revealed after signup', type: 'text' },
      { name: 'cta_label', label: 'Button label', type: 'text' }, { name: 'cta_href', label: 'Button link', type: 'text', placeholder: '/collections/sale' },
      { name: 'trigger', label: 'Trigger', type: 'select', options: [['delay', 'After a delay'], ['scroll', 'After scrolling'], ['exit_intent', 'Exit intent'], ['page_load', 'On page load']], section: 'Behaviour' },
      { name: 'delay_seconds', label: 'Delay (seconds)', type: 'number', showIf: { field: 'trigger', in: ['delay'] } },
      { name: 'scroll_percent', label: 'Scroll depth %', type: 'number', showIf: { field: 'trigger', in: ['scroll'] } },
      { name: 'frequency_days', label: 'Show at most once every (days)', type: 'number' },
      { name: 'audience', label: 'Audience', type: 'select', options: [['all', 'Everyone'], ['new_visitors', 'New visitors'], ['returning_visitors', 'Returning visitors'], ['guests', 'Signed-out visitors'], ['customers', 'Signed-in customers']] },
      { name: 'devices', label: 'Devices', type: 'tags', hint: 'desktop, mobile', default: ['desktop', 'mobile'] },
      { name: 'page_paths', label: 'Only on pages', type: 'tags', hint: 'e.g. / or /products/* — empty = all pages' },
      { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' },
      { name: 'style_layout', label: 'Layout', type: 'select', options: [['split', 'Image + text'], ['center', 'Text only']], section: 'Style' },
      { name: 'style_background', label: 'Background', type: 'select', options: [['ivory', 'Ivory'], ['emerald', 'Emerald']] },
      { name: 'priority', label: 'Priority (higher shows first)', type: 'number' },
      { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  announcements: {
    key: 'announcements', table: 'announcements', title: 'Announcement bar', singular: 'announcement', titleField: 'message', permission: 'popups.manage', refresh: 'content',
    description: 'Messages that rotate in the bar at the top of every page.', orderBy: [['sort', true]],
    columns: [{ name: 'message', label: 'Message' }, { name: 'href', label: 'Link' }, { name: 'starts_at', label: 'Starts', format: 'datetime' }, { name: 'ends_at', label: 'Ends', format: 'datetime' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    fields: [
      { name: 'message', label: 'Message', type: 'text', required: true, span: 2 }, { name: 'href', label: 'Link', type: 'text', placeholder: '/collections/new-arrivals' },
      { name: 'sort', label: 'Order', type: 'number' }, { name: 'background', label: 'Background colour', type: 'color' }, { name: 'text_color', label: 'Text colour', type: 'color' },
      { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' },
      { name: 'dismissible', label: 'Show close button', type: 'boolean', default: true }, { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
  },
  social: {
    key: 'social', table: 'social_posts', title: 'Social gallery', singular: 'post', titleField: 'caption', permission: 'social.manage', refresh: 'content',
    description: 'Curate Instagram/TikTok images for the homepage and link them to products.', orderBy: [['sort', true]],
    columns: [{ name: 'image_url', label: 'Image', format: 'image' }, { name: 'caption', label: 'Caption' }, { name: 'platform', label: 'Platform', format: 'badge' }, { name: 'product_ids', label: 'Products', format: 'count' }, { name: 'is_visible', label: 'Visible', format: 'boolean' }],
    fields: [
      { name: 'image_url', label: 'Image', type: 'media', required: true }, { name: 'platform', label: 'Platform', type: 'select', options: [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['other', 'Other']] },
      { name: 'permalink', label: 'Post link', type: 'text', placeholder: 'https://www.instagram.com/p/…', span: 2 }, { name: 'caption', label: 'Caption / alt text', type: 'textarea', span: 2 },
      { name: 'product_ids', label: 'Shop this look — products', type: 'multiselect', optionsFrom: 'products', span: 2 },
      { name: 'sort', label: 'Order', type: 'number' }, { name: 'is_visible', label: 'Visible', type: 'boolean', default: true },
    ],
  },
  'shipping-zones': {
    key: 'shipping-zones', table: 'shipping_zones', title: 'Shipping zones', singular: 'zone', titleField: 'name', permission: 'shipping.manage', refresh: 'content', orderBy: [['sort', true]],
    columns: [{ name: 'name', label: 'Zone' }, { name: 'countries', label: 'Countries', format: 'list' }, { name: 'states', label: 'Regions', format: 'list' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'sort', label: 'Order', type: 'number' },
      { name: 'countries', label: 'Countries (ISO codes)', type: 'tags', hint: 'e.g. NG. Use * for “rest of world”.', span: 2 },
      { name: 'states', label: 'States / regions', type: 'tags', hint: 'Optional — e.g. Lagos. Empty = the whole country.', span: 2 },
      { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
  },
  'shipping-methods': {
    key: 'shipping-methods', table: 'shipping_methods', title: 'Shipping methods', singular: 'method', titleField: 'name', permission: 'shipping.manage', refresh: 'content', orderBy: [['sort', true]],
    select: '*, shipping_zones(name)',
    columns: [{ name: 'name', label: 'Method' }, { name: 'shipping_zones.name', label: 'Zone' }, { name: 'service_level', label: 'Level', format: 'badge' }, { name: 'base_rate', label: 'Rate', format: 'money' }, { name: 'free_over', label: 'Free over', format: 'money' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    filters: [{ name: 'zone_id', label: 'Zone', options: [] }],
    fields: [
      { name: 'zone_id', label: 'Zone', type: 'select', optionsFrom: 'shipping_zones', required: true }, { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'carrier', label: 'Carrier', type: 'text' }, { name: 'service_level', label: 'Service level', type: 'select', options: [['standard', 'Standard'], ['express', 'Express'], ['pickup', 'Pickup']] },
      { name: 'description', label: 'Description', type: 'text', span: 2 },
      { name: 'rate_type', label: 'Rate type', type: 'select', options: [['flat', 'Flat rate'], ['weight', 'Weight-based'], ['order_value', 'By order value']] },
      { name: 'base_rate', label: 'Base rate', type: 'money' }, { name: 'per_kg_rate', label: 'Per additional kg', type: 'money', showIf: { field: 'rate_type', in: ['weight'] } },
      { name: 'rate_table', label: 'Order value tiers', type: 'list', showIf: { field: 'rate_type', in: ['order_value'] }, listFields: [{ key: 'min', label: 'From order value (kobo)', type: 'number' }, { key: 'rate', label: 'Rate (kobo)', type: 'number' }], span: 2 },
      { name: 'free_over', label: 'Free over (order value)', type: 'money' },
      { name: 'min_days', label: 'Min days', type: 'number' }, { name: 'max_days', label: 'Max days', type: 'number' },
      { name: 'sort', label: 'Order', type: 'number' }, { name: 'is_active', label: 'Active', type: 'boolean', default: true },
    ],
  },
  taxes: {
    key: 'taxes', table: 'tax_rules', title: 'Tax rules', singular: 'tax rule', titleField: 'name', permission: 'taxes.manage', refresh: 'content', orderBy: [['country', true]],
    description: 'Active rules add tax at checkout. Leave rules inactive if your prices already include VAT.',
    columns: [{ name: 'name', label: 'Name' }, { name: 'country', label: 'Country' }, { name: 'state', label: 'Region' }, { name: 'rate_percent', label: 'Rate %' }, { name: 'is_active', label: 'Active', format: 'boolean' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'country', label: 'Country (ISO)', type: 'text', required: true }, { name: 'state', label: 'Region (optional)', type: 'text' },
      { name: 'rate_percent', label: 'Rate %', type: 'number', required: true }, { name: 'tax_class', label: 'Tax class', type: 'text', default: 'standard' },
      { name: 'applies_to_shipping', label: 'Also tax shipping', type: 'boolean' }, { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },
  categories: {
    key: 'categories', table: 'categories', title: 'Categories', singular: 'category', titleField: 'name', permission: 'categories.manage', refresh: 'catalog', orderBy: [['sort', true]],
    select: '*, parent:parent_id(name)',
    columns: [{ name: 'name', label: 'Category' }, { name: 'parent.name', label: 'Parent' }, { name: 'slug', label: 'Slug' }, { name: 'sort', label: 'Order' }, { name: 'is_visible', label: 'Visible', format: 'boolean' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'parent_id', label: 'Parent category', type: 'select', optionsFrom: 'categories' }, { name: 'sort', label: 'Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea', span: 2 }, { name: 'image_id', label: 'Image', type: 'mediaId' },
      { name: 'is_visible', label: 'Visible', type: 'boolean', default: true },
      { name: 'seo_title', label: 'SEO title', type: 'text', section: 'SEO' }, { name: 'seo_description', label: 'Meta description', type: 'textarea', span: 2 },
    ],
  },
  attributes: {
    key: 'attributes', table: 'attribute_values', title: 'Attributes', singular: 'attribute value', titleField: 'label', permission: 'categories.manage', refresh: 'catalog',
    description: 'Textures, lengths, colours, lace, density and construction values used by variants, filters and navigation.',
    orderBy: [['attribute', true], ['sort', true]],
    columns: [{ name: 'attribute', label: 'Attribute', format: 'badge' }, { name: 'label', label: 'Label' }, { name: 'slug', label: 'Value' }, { name: 'sort', label: 'Order' }, { name: 'show_in_nav', label: 'In menu', format: 'boolean' }],
    filters: [{ name: 'attribute', label: 'Attribute', options: [['texture', 'Texture'], ['length', 'Length'], ['color', 'Colour'], ['lace', 'Lace'], ['density', 'Density'], ['construction', 'Construction'], ['cap_size', 'Cap size']] }],
    fields: [
      { name: 'attribute', label: 'Attribute', type: 'select', required: true, options: [['texture', 'Texture'], ['length', 'Length'], ['color', 'Colour'], ['lace', 'Lace'], ['density', 'Density'], ['construction', 'Construction'], ['cap_size', 'Cap size']] },
      { name: 'label', label: 'Label', type: 'text', required: true }, { name: 'slug', label: 'Value (used in URLs)', type: 'slug', slugFrom: 'label', required: true },
      { name: 'sort', label: 'Order', type: 'number' }, { name: 'swatch', label: 'Swatch colour', type: 'color' }, { name: 'image_id', label: 'Guide image', type: 'mediaId' },
      { name: 'description', label: 'Description (texture guide)', type: 'textarea', span: 2 }, { name: 'show_in_nav', label: 'Show in “Shop by” menu', type: 'boolean' },
    ],
  },
  collections: {
    key: 'collections', table: 'collections', title: 'Collections', singular: 'collection', titleField: 'name', permission: 'collections.manage', refresh: 'catalog', orderBy: [['sort', true]],
    select: '*, collection_products(count)',
    description: 'Curated groups such as Best Sellers, Signature and Sale. Assign products here or in the product editor.',
    columns: [{ name: 'name', label: 'Collection' }, { name: 'slug', label: 'Slug' }, { name: 'collection_products', label: 'Products', format: 'count' }, { name: 'deal_price', label: 'Set price', format: 'money' }, { name: 'is_visible', label: 'Visible', format: 'boolean' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true },
      { name: 'tagline', label: 'Tagline', type: 'text', span: 2 }, { name: 'description', label: 'Description', type: 'textarea', span: 2 },
      { name: 'image_id', label: 'Image', type: 'mediaId' }, { name: 'sort', label: 'Order', type: 'number' },
      { name: '_products', label: 'Products in this collection', type: 'multiselect', optionsFrom: 'products', span: 2 },
      { name: 'deal_enabled', label: 'Complete-set price', type: 'boolean', section: 'Collection deal', hint: 'Customers buying every product get the set price.' },
      { name: 'deal_price', label: 'Set price', type: 'money', showIf: { field: 'deal_enabled', in: ['true'] } },
      { name: 'is_featured', label: 'Featured', type: 'boolean' }, { name: 'is_visible', label: 'Visible', type: 'boolean', default: true },
      { name: 'seo_title', label: 'SEO title', type: 'text', section: 'SEO' }, { name: 'seo_description', label: 'Meta description', type: 'textarea', span: 2 },
    ],
  },
  'blog-categories': {
    key: 'blog-categories', table: 'blog_categories', title: 'Journal categories', singular: 'category', titleField: 'name', permission: 'blog.edit_any', refresh: 'content', orderBy: [['sort', true]],
    columns: [{ name: 'name', label: 'Name' }, { name: 'slug', label: 'Slug' }, { name: 'sort', label: 'Order' }],
    fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'slug', label: 'Slug', type: 'slug', slugFrom: 'name', required: true }, { name: 'sort', label: 'Order', type: 'number' }],
  },
  expenses: {
    key: 'expenses', table: 'expenses', title: 'Business expenses', singular: 'expense', titleField: 'description', permission: 'expenses.manage', refresh: null, orderBy: [['spent_on', false]],
    description: 'Record costs (ads, shipping, packaging, salaries, rent, stock purchases…) so net profit is accurate.',
    columns: [{ name: 'spent_on', label: 'Date', format: 'date' }, { name: 'category', label: 'Category', format: 'badge' }, { name: 'description', label: 'Description' }, { name: 'amount', label: 'Amount', format: 'money' }],
    filters: [{ name: 'category', label: 'Category', options: [['advertising', 'Advertising'], ['shipping', 'Shipping & logistics'], ['packaging', 'Packaging'], ['salaries', 'Salaries & staff'], ['rent', 'Rent & utilities'], ['software', 'Software & fees'], ['stock_purchase', 'Stock purchase'], ['other', 'Other']] }],
    fields: [
      { name: 'spent_on', label: 'Date', type: 'date', required: true }, { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'category', label: 'Category', type: 'select', required: true, options: [['advertising', 'Advertising'], ['shipping', 'Shipping & logistics'], ['packaging', 'Packaging'], ['salaries', 'Salaries & staff'], ['rent', 'Rent & utilities'], ['software', 'Software & fees'], ['stock_purchase', 'Stock purchase (not per-item cost)'], ['other', 'Other']] },
      { name: 'description', label: 'Description', type: 'text', span: 2 },
    ],
  },
  consultations: {
    key: 'consultations', table: 'consultations', title: 'Consultations & custom requests', singular: 'request', titleField: 'name', permission: 'consultations.manage', refresh: null, noCreate: true,
    orderBy: [['created_at', false]], searchable: ['name', 'email'],
    columns: [{ name: 'name', label: 'Name' }, { name: 'kind', label: 'Type', format: 'badge' }, { name: 'email', label: 'Email' }, { name: 'preferred_at', label: 'Preferred', format: 'datetime' }, { name: 'status', label: 'Status', format: 'badge' }, { name: 'created_at', label: 'Received', format: 'datetime' }],
    filters: [{ name: 'status', label: 'Status', options: [['new', 'New'], ['contacted', 'Contacted'], ['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] }],
    fields: [
      { name: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['contacted', 'Contacted'], ['scheduled', 'Consultation scheduled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] },
      { name: 'scheduled_for', label: 'Scheduled for', type: 'datetime' }, { name: 'assigned_to', label: 'Assigned to', type: 'select', optionsFrom: 'staff' },
      { name: 'admin_notes', label: 'Internal notes', type: 'textarea', span: 2 },
      { name: 'kind', label: 'Type', type: 'readonly', section: 'Request' }, { name: 'name', label: 'Name', type: 'readonly' }, { name: 'email', label: 'Email', type: 'readonly' }, { name: 'phone', label: 'Phone', type: 'readonly' },
      { name: 'contact_method', label: 'Preferred contact', type: 'readonly' }, { name: 'preferred_at', label: 'Preferred time', type: 'readonly' },
      { name: 'texture', label: 'Texture', type: 'readonly' }, { name: 'length', label: 'Length', type: 'readonly' }, { name: 'budget', label: 'Budget', type: 'readonly' },
      { name: 'desired_look', label: 'Desired look', type: 'readonly', span: 2 }, { name: 'configuration', label: 'Configuration', type: 'readonly', span: 2 },
    ],
  },
  messages: {
    key: 'messages', table: 'contact_messages', title: 'Messages', singular: 'message', titleField: 'subject', permission: 'messages.view', refresh: null, noCreate: true,
    orderBy: [['created_at', false]], searchable: ['name', 'email', 'subject'],
    columns: [{ name: 'name', label: 'From' }, { name: 'email', label: 'Email' }, { name: 'subject', label: 'Subject' }, { name: 'status', label: 'Status', format: 'badge' }, { name: 'created_at', label: 'Received', format: 'datetime' }],
    filters: [{ name: 'status', label: 'Status', options: [['new', 'New'], ['replied', 'Replied'], ['closed', 'Closed']] }],
    fields: [
      { name: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['replied', 'Replied'], ['closed', 'Closed']] },
      { name: 'name', label: 'Name', type: 'readonly' }, { name: 'email', label: 'Email', type: 'readonly' }, { name: 'phone', label: 'Phone', type: 'readonly' },
      { name: 'order_number', label: 'Order', type: 'readonly' }, { name: 'subject', label: 'Subject', type: 'readonly', span: 2 }, { name: 'message', label: 'Message', type: 'readonly', span: 2 },
    ],
  },
  newsletter: {
    key: 'newsletter', table: 'newsletter_subscribers', title: 'Newsletter subscribers', singular: 'subscriber', titleField: 'email', permission: 'newsletter.view', refresh: null, noCreate: true,
    orderBy: [['created_at', false]], searchable: ['email'],
    columns: [{ name: 'email', label: 'Email' }, { name: 'source', label: 'Source' }, { name: 'consent_at', label: 'Subscribed', format: 'datetime' }, { name: 'unsubscribed_at', label: 'Unsubscribed', format: 'datetime' }],
    fields: [{ name: 'email', label: 'Email', type: 'readonly' }, { name: 'source', label: 'Source', type: 'readonly' }, { name: 'unsubscribed_at', label: 'Unsubscribed at', type: 'datetime' }],
  },
};
