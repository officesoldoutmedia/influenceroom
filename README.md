# Influencer Room

Internal operations app for influencer marketing & artist management.

## Quick start

```bash
pnpm install
pnpm dev          # local Next.js dev (Node runtime)
pnpm preview      # local with Workers runtime simulation (opennextjs-cloudflare preview)
```

## Deployment

Deployment is fully managed by **Cloudflare Workers Builds → Git integration**:

```bash
git push origin main   # auto-deploys to production via Workers Builds
```

Do not run `pnpm run deploy` from local. The Worker is connected to this repo once
via the Cloudflare dashboard (Workers & Pages → Create → Workers → Connect to Git).

## Documentation

- [Product Requirements (single source of truth)](./docs/influencer-room-prd.md)
