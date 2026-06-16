# Duke Realty

Interactive site layout app for Duke Realty's Antonia and Aranya projects.

## Local Development

```sh
npm install
npm run dev
```

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
- Branding assets live in `public/duke-realty-logo.png` with generated icon assets for favicons and installable app metadata.
- The current login is client-side role gating for a static app. For a public production deployment with sensitive data, replace it with server-backed authentication and authorization.
- See `SECURITY_DEPLOYMENT.md` before deploying for company use.
