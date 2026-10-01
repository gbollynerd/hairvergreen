# Deploying Hairver Green

The database is already set up on your Supabase project **HairverGreen** (`wbzgeooiioxjujpdcrfd`). All 9 migrations and the demo content are applied. What's left is GitHub, Vercel and a few dashboard settings.

## 1. Push the code to GitHub

From the project folder:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env.local` and `node_modules` are git-ignored. Never commit keys.

## 2. Import the project on Vercel

Vercel → **Add New → Project** → pick the repo. Framework: **Next.js** (auto-detected). Leave the build settings at their defaults.

Before the first deploy, add these under **Settings → Environment Variables** for Production, and for Preview too if you want preview deploys to work:

| Variable | Value | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | Use the `*.vercel.app` URL until your domain is connected. No trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbzgeooiioxjujpdcrfd.supabase.co` | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_GGS2rDBkYcAlZZ2xpo2WTg_MtgdW6rq` | Supabase → Project Settings → API Keys. This key is public by design. |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_…`) or legacy `service_role` key | Supabase → Project Settings → API Keys. **Keep secret.** |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` to start, then `sk_live_…` | Paystack → Settings → API Keys & Webhooks |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_test_…` / `pk_live_…` | Same place. Optional; checkout uses Paystack's hosted page. |
| `RESEND_API_KEY` | `re_…` | resend.com → API Keys. Optional: without it, emails are skipped and logged. |
| `EMAIL_FROM` | `Hairver Green <orders@your-domain.com>` | The domain must be verified in Resend. |
| `BOOTSTRAP_SUPER_ADMIN_EMAILS` | your email, e.g. `you@gmail.com` | Grants you Super Admin the first time you sign in. |
| `CRON_SECRET` | any long random string | Vercel sends it automatically to the daily maintenance job. |

Deploy. Each later push to `main` redeploys automatically.

## 3. Supabase Auth settings

Supabase → **Authentication → URL Configuration**:

- **Site URL:** your live URL (same as `NEXT_PUBLIC_SITE_URL`).
- **Redirect URLs:** add `https://your-domain.com/auth/callback` and `https://your-domain.com/auth/confirm`. Add the same two paths for your `*.vercel.app` URL.

Optional: under **Authentication → Emails → SMTP**, use Resend's SMTP so sign-up and password emails come from your domain.

## 4. Paystack webhook

Paystack → **Settings → API Keys & Webhooks → Webhook URL**:

```
https://your-domain.com/api/webhooks/paystack
```

Orders are marked paid only after Paystack confirms the payment server-side. Repeated webhooks are ignored safely.

## 5. Create your admin account

1. Visit `/register` and create an account with the email you put in `BOOTSTRAP_SUPER_ADMIN_EMAILS`, then confirm the email.
2. Sign in at `/admin`. You are now Super Admin.
3. Invite your team under **Admin → Staff**, and choose their roles under **Roles & permissions**.
4. Optionally, remove your email from `BOOTSTRAP_SUPER_ADMIN_EMAILS` afterwards. The role stays.

## 6. Connect your domain

Vercel → Project → **Settings → Domains**. Then update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL and redirect URLs, and the Paystack webhook to the new domain, and redeploy.

## 7. Go-live checklist

- [ ] Real products, prices, **cost prices** and photos are added.
- [ ] Demo content is cleared (`supabase/clear_demo.sql` in the SQL editor).
- [ ] Policies are written: Privacy, Terms, Refund, Shipping and Cookie.
- [ ] Store details, WhatsApp and social links are set in Settings, and shipping rates are checked.
- [ ] Paystack is on live keys, and one real low-value order has been paid and refunded end to end.
- [ ] A test order confirmation email has arrived (Resend).
- [ ] GA4 / Meta / TikTok IDs are added in Settings → Analytics, if you use them. They load only after cookie consent.
- [ ] The sitemap `https://your-domain.com/sitemap.xml` is submitted in Google Search Console.

## Notes

- **Database changes:** new migrations go in `supabase/migrations/`. Apply them with `supabase db push`, or paste them into the SQL editor.
- **Backups:** the Supabase free tier has limited backups, so upgrade before you depend on it for sales. Free projects also pause after a week of inactivity; a live store's traffic keeps it awake.
- **Scheduled job:** `/api/cron/maintenance` runs daily at 06:00 UTC (07:00 Lagos). It releases expired stock holds. Holds are also released whenever a new order is placed.
