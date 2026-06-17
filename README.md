# Duke Realty

Interactive site layout app for Duke Realty's Antonia and Aranya projects.

## Local Development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Run `supabase/schema.sql` in the Supabase SQL Editor before signing in.

## Production Build

```sh
npm run deploy:check
npm run preview
```

Deploy the generated `dist/` directory to a static host such as Netlify, Vercel, Cloudflare Pages, or any static web server.

## Deployment Notes

- Build command: `npm run build`
- Publish directory: `dist`
- Routing: the app uses hash routes, and `public/_redirects` is included for static-host SPA fallback.
- GitHub Pages: `.github/workflows/pages.yml` builds and deploys `dist/` after pushes to `main` or `master`.
- Vercel environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Branding assets live in `public/duke-realty-logo.png` with generated icon assets for favicons and installable app metadata.
- Authentication and shared data are backed by Supabase Auth/Postgres. Role profiles are stored in `public.user_profiles`.
- See `SECURITY_DEPLOYMENT.md` before deploying for company use.

## Supabase Setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor.
3. Create users in `Authentication > Users`.
4. Add each user to `public.user_profiles` with a lowercase username and role `admin`, `sales`, `site`, or `super_admin`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel.

Example profile insert after creating a user:

```sql
insert into public.user_profiles (id, username, role, name, label)
values (
  (select id from auth.users where email = 'owner@example.com'),
  'admin',
  'admin',
  'Admin',
  'Administrator'
);
```

Users can sign in with either their Supabase email address or the username from `public.user_profiles.username`.

The online-user super admin panel is available to `super_admin` users from the app navigation or directly at:

```text
#/super-admin
```

To add a username to an existing profile:

```sql
update public.user_profiles
set username = 'admin'
where id = (select id from auth.users where email = 'owner@example.com');
```
