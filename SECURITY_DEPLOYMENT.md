# Duke Realty Deployment Security

## Current Status

This project is ready for a static demo deployment, but it is not secure enough for a company production system that stores private customer, booking, pricing, construction, or internal notes.

The current app uses:

- Client-side demo credentials in `js/auth.js`
- `sessionStorage` for login state
- `localStorage` for house/customer/project data
- Client-side role filtering

That means a public deployment must be treated as a demo/read-only prototype unless it is placed behind a real access-control layer.

## Safe Deployment Options

For immediate internal review:

- Deploy `dist/` behind platform-level access protection.
- Recommended: Cloudflare Access, Vercel Deployment Protection, Netlify password protection, VPN, or an authenticated reverse proxy.
- Do not enter real customer phone numbers, prices, internal notes, or private booking details into this static build.

For company production:

- Move authentication to a server or managed identity provider.
- Store house/customer data in a server-side database.
- Enforce roles on the server, not in browser code.
- Remove demo passwords from shipped JavaScript.
- Add audit logs and backups for booking/admin changes.

## Static Host Settings

- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback: `/* /index.html 200`
- Security headers are included in `public/_headers`.
- Search indexing is blocked through `robots.txt` and `noindex` metadata.

## Pre-Deployment Check

Run:

```sh
npm run deploy:check
```

Then deploy the generated `dist/` directory.
