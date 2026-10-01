# Hairver Green

The ecommerce platform for **Hairver Green — Luxury Hair House · Lagos**. It includes the storefront, checkout, customer accounts, and a full admin for running the business: orders, returns, profit reporting, content and staff.

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Supabase (Postgres, Auth and Storage), Paystack and Resend. It deploys to Vercel.
- **Money:** every amount is stored in kobo as an integer. Customers can view prices in USD, GBP or EUR, but they are always charged in NGN.
- **Deployment:** see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What's inside

| Area | Highlights |
| --- | --- |
| Storefront | CMS-driven homepage and pages; mega-menu; listings with filters and search; product pages with variants and gallery; bundles; collection deals; wishlist; cart drawer; recently viewed; Hair Journal |
| Checkout | Guest or account checkout. Shipping comes from zones and methods; tax and coupon rules apply. Stock is reserved while payment is pending. Paystack payments are verified server-side, and webhooks are signature-checked and idempotent. |
| Accounts | Customers can see orders, invoices and tracking, and request returns. They can also manage addresses, their wishlist, account details and notification preferences. |
| Services | Custom unit configurator: pricing comes from settings, and some options flag the order for staff review. Customers can also book consultations. |
| Admin | **Dashboard and Sales & profit:** revenue, COGS, fees, expenses and net profit.<br>**Orders:** orders, fulfilment, invoices, returns and refunds (Paystack refund API), and payments.<br>**Customers:** abandoned carts with recovery links, customers and segments.<br>**Catalogue:** products with variants and bundles, inventory with an audit trail, categories and collections.<br>**Marketing:** discounts and coupons, campaigns, popups, announcement bar and social gallery.<br>**Content:** page builder, Hair Journal (draft → review → schedule → publish), media library and navigation.<br>**Operations:** shipping and taxes.<br>**Administration:** staff and roles with granular permissions, settings and theme, and the audit log. |
| Security | Row-level security on every table. Permission checks run on the server for every admin action, and privilege escalation is blocked. Secrets live only in environment variables, and HTML is sanitised. Uploads go through signed URLs, and every admin change is logged. |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys (Paystack/Resend optional)
npm run dev
```

Apply the database with the Supabase CLI (`supabase db push`), or paste each file from `supabase/migrations` into the SQL editor in order. Then run `supabase/seed.sql` to load the demo catalogue.

To get your first admin, add your email to `BOOTSTRAP_SUPER_ADMIN_EMAILS`, create an account at `/register`, and sign in at `/admin`.

## Project layout

```
src/app/(store)        storefront routes          src/app/admin           admin panel
src/app/(checkout)     checkout                   src/app/api             route handlers (cart, checkout, webhooks, cron…)
src/lib/commerce       pricing, cart, orders      src/lib/payments        payment provider abstraction (Paystack)
src/lib/data           cached catalogue/content   src/lib/admin           reports, resources, page-builder schema
supabase/migrations    schema, functions, RLS     supabase/seed.sql       demo data (labelled as demo)
```

## Before launch

1. Replace the demo products, artwork and journal posts. Use `supabase/clear_demo.sql` to remove test orders and sample content.
2. Write your real policies (Privacy, Terms, Refund, Shipping and Cookie) under **Admin → Pages**. They currently contain placeholders.
3. Add cost prices to variants so profit reporting is accurate, and log your business expenses.
4. Switch Paystack to live keys and run one small real payment end to end.
