# Duke Realty Deployment Security

## Current Status

This app now uses Supabase Auth and Supabase Postgres for shared booking data.

The current app uses:

- Supabase Auth for user sessions.
- Supabase Postgres for house, booking, construction, and internal data.
- Role profiles in `public.user_profiles`.
- Postgres RPC functions for role-filtered reads and admin-only writes.
- A non-sensitive `house_change_events` table for realtime refreshes.

Do not deploy without running `supabase/schema.sql` and adding production Supabase environment variables.

## Required Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create real users in `Authentication > Users`.
4. Insert each user's profile in `public.user_profiles` with role `admin`, `sales`, or `site`.
5. Add Vercel environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Never add a Supabase service-role key to this frontend or to any `VITE_` environment variable.

## Access Control

For company use, keep one of these enabled until the access model is finalized:

- Vercel Deployment Protection or team-only access
- Cloudflare Access
- VPN or authenticated reverse proxy

## Production Notes

- Supabase backups should be enabled according to the business plan.
- Review customer data handling and retention requirements before entering real customer data.
- Add a formal audit-log table if regulatory-grade history is required.
- Keep the source repo private if project/customer information is sensitive.

## Static Host Settings

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA fallback: `/* /index.html 200`
- Security headers are included in `public/_headers` and `vercel.json`.
- Search indexing is blocked through `robots.txt` and `noindex` metadata.

## Pre-Deployment Check

Run:

```sh
npm run deploy:check
```

Then deploy the generated `dist/` directory.
