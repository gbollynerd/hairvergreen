// Hand-maintained row types for the tables the app touches most.
// (Regenerate full types any time with: npx supabase gen types typescript --project-id <ref>)

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type Media = {
  id: string; url: string; alt: string; title: string | null; kind: 'image' | 'video' | 'file';
  width: number | null; height: number | null; mime_type: string | null; filename: string | null;
  folder_id: string | null; tags: string[]; path: string | null; bucket: string; size_bytes: number | null; created_at: string;
};

export type AttributeValue = {
  id: string; attribute: string; label: string; slug: string; sort: number; swatch: string | null;
  description: string | null; show_in_nav: boolean; image_id: string | null;
};

export type Category = {
  id: string; parent_id: string | null; name: string; slug: string; description: string | null; image_id: string | null;
  sort: number; is_visible: boolean; seo_title: string | null; seo_description: string | null;
  image?: Media | null; parent?: Pick<Category, 'id' | 'slug' | 'name'> | null;
};

export type Variant = {
  id: string; product_id: string; sku: string | null; title: string; options: Record<string, string>;
  price: number; compare_at_price: number | null; cost_price?: number | null; weight_grams: number | null; image_id: string | null;
  is_active: boolean; position: number; track_inventory: boolean; stock_on_hand: number; stock_reserved: number;
  low_stock_threshold: number; allow_backorder: boolean; restock_date: string | null;
};

export type ProductMedia = { id: string; media_id: string; option_match: Record<string, string>; sort: number; alt: string | null; media: Media };

export type ProductDetails = {
  origin?: string; grade?: string; hair_info?: string; weight_per_bundle?: string; lace_info?: string; density_info?: string;
  construction?: string; cap?: string; production_time?: string; care?: string; shipping_note?: string; returns_note?: string;
  faq?: { q: string; a: string }[]; size_guide?: string;
};

export type Product = {
  id: string; name: string; slug: string; sku: string | null;
  product_type: 'hair' | 'wig' | 'bundle_deal' | 'accessory' | 'custom_unit' | 'service' | 'gift_card';
  category_id: string | null; brand: string; status: 'draft' | 'active' | 'hidden' | 'archived'; publish_at: string | null;
  short_description: string | null; description: string | null; details: ProductDetails; tags: string[]; option_keys: string[];
  price: number; compare_at_price: number | null; is_featured: boolean; is_new: boolean; requires_review: boolean;
  weight_grams: number; shipping_class: string; tax_class: string; seo_title: string | null; seo_description: string | null;
  og_image_id: string | null; noindex: boolean; rating_avg: number; rating_count: number; sales_count: number;
  created_at: string; updated_at: string;
};

export type ProductCardData = Pick<Product, 'id' | 'name' | 'slug' | 'product_type' | 'is_new' | 'rating_avg' | 'rating_count' | 'short_description'> & {
  price_min: number; price_max: number; compare_at: number | null; in_stock: boolean; images: { url: string; alt: string }[];
  option_keys: string[]; variant_count: number; default_variant_id: string | null;
};

export type ProductFull = Product & {
  category: (Category & { parent: Pick<Category, 'id' | 'slug' | 'name'> | null }) | null;
  variants: Variant[];
  media: ProductMedia[];
  bundle: Bundle | null;
};

export type BundleItem = {
  id: string; product_id: string; variant_id: string | null; quantity: number; is_optional: boolean; label: string | null; sort: number;
  product: Pick<Product, 'id' | 'name' | 'slug' | 'option_keys'> & { variants: Variant[] };
};
export type Bundle = { product_id: string; pricing_mode: 'fixed' | 'percent_off' | 'amount_off'; value: number; headline: string | null; items: BundleItem[] };

export type Collection = {
  id: string; name: string; slug: string; tagline: string | null; description: string | null; image_id: string | null;
  is_visible: boolean; is_featured: boolean; sort: number; deal_enabled: boolean; deal_price: number | null;
  seo_title: string | null; seo_description: string | null; image?: Media | null;
};

export type Review = {
  id: string; product_id: string; author_name: string; author_location: string | null; rating: number; title: string | null; body: string;
  media: { url: string; kind: string }[]; is_verified: boolean; status: string; admin_response: string | null; created_at: string;
  product?: { name: string; slug: string } | null;
};

export type Address = {
  id?: string; label?: string | null; first_name: string; last_name: string; phone?: string | null; line1: string; line2?: string | null;
  city: string; state?: string | null; postal_code?: string | null; country: string; is_default_shipping?: boolean; is_default_billing?: boolean;
};

export type OrderStatus = 'pending_payment' | 'paid' | 'payment_failed' | 'processing' | 'ready_for_shipment' | 'shipped'
  | 'delivered' | 'cancelled' | 'refund_requested' | 'refunded' | 'partially_refunded';

export type Order = {
  id: string; order_number: string; user_id: string | null; customer_id: string | null; email: string; phone: string | null; customer_name: string | null;
  status: OrderStatus; payment_status: string; fulfillment_status: string; requires_review: boolean; review_status: string | null;
  currency: string; subtotal: number; discount_total: number; shipping_total: number; tax_total: number; total: number; refunded_total: number;
  cost_total: number; payment_fees: number; discount_codes: string[]; discount_breakdown: { label: string; amount: number }[];
  shipping_method: { id: string; name: string; carrier?: string; min_days?: number; max_days?: number } | null;
  shipping_address: Address | null; billing_address: Address | null; shipping_country: string | null;
  carrier: string | null; tracking_number: string | null; tracking_url: string | null; customer_note: string | null;
  payment_provider: string | null; payment_reference: string | null; payment_channel: string | null; inventory_state: string;
  placed_at: string; paid_at: string | null; shipped_at: string | null; delivered_at: string | null; cancelled_at: string | null; created_at: string;
};

export type OrderItem = {
  id: string; order_id: string; product_id: string | null; variant_id: string | null; product_name: string; variant_title: string | null;
  sku: string | null; image_url: string | null; options: Record<string, string>; unit_price: number; compare_at_price: number | null;
  quantity: number; line_discount: number; line_total: number; unit_cost: number; returned_quantity: number;
  bundle_components: { product_id: string; variant_id: string; name: string; variant_title: string; quantity: number }[] | null;
  customization: Record<string, unknown> | null;
};

export type OrderEvent = { id: number; type: string; message: string; is_internal: boolean; actor_name: string | null; created_at: string; data: Json };

export type PageSection = { id: string; page_id: string; type: string; name: string | null; sort: number; is_visible: boolean; settings: Record<string, any> };
export type Page = {
  id: string; slug: string; title: string; kind: string; status: string; body: string | null; seo_title: string | null;
  seo_description: string | null; og_image_id: string | null; noindex: boolean; published_at: string | null; updated_at: string;
};

export type MenuItem = { label: string; href: string; children?: MenuItem[]; auto?: 'texture' | 'length'; feature?: { title: string; href: string; image: string } };

export type BlogPost = {
  id: string; slug: string; title: string; excerpt: string | null; body: string; category_id: string | null; tags: string[];
  featured_image_id: string | null; author_id: string | null; author_name: string | null; status: string; published_at: string | null;
  related_product_ids: string[]; related_post_ids: string[]; reading_minutes: number | null; seo_title: string | null;
  seo_description: string | null; video_url: string | null; gallery: { url: string; alt?: string }[]; noindex: boolean;
  created_at: string; updated_at: string;
  featured_image?: Media | null; category?: { name: string; slug: string } | null;
};

export type Popup = {
  id: string; name: string; kind: string; title: string; body: string | null; image_id: string | null; cta_label: string | null; cta_href: string | null;
  coupon_code: string | null; collect_email: boolean; trigger: 'delay' | 'exit_intent' | 'scroll' | 'page_load'; delay_seconds: number;
  scroll_percent: number; frequency_days: number; audience: string; devices: string[]; page_paths: string[];
  starts_at: string | null; ends_at: string | null; style: Record<string, string>; is_active: boolean; priority: number;
  image?: Media | null;
};

export type Announcement = { id: string; message: string; href: string | null; background: string | null; text_color: string | null; dismissible: boolean };

export type ThemeSettings = {
  colors: Record<string, string>; fonts: { display: string; body: string }; radius: 'none' | 'sm' | 'md' | 'lg';
  button_style: 'solid' | 'outline'; product_card: 'editorial' | 'minimal'; animations: 'subtle' | 'none' | 'expressive';
  logo_media_url: string | null; favicon_url: string | null;
};

export type StoreSettings = {
  name: string; short_name: string; tagline: string; email: string; phone: string; whatsapp: string; address: string;
  city: string; country: string; instagram: string; tiktok: string; support_hours: string;
};
