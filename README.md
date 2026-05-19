# iag-api-gateway

IAG platform **API gateway** — single public ingress for microservices. Verifies JWTs against authentication JWKS, enforces route policies in `src/policies.ts`, forwards principal headers to upstreams, and proxies HTTP to platform services.

| Item | Value |
|------|-------|
| Port (local) | 8080 |
| Health | `GET /health`, `GET /ready` |
| Route registry | `src/routes.ts` (`UPSTREAM_*` env vars) |
| Auth policies | `src/policies.ts` |

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 9+

## Quick start

```bash
pnpm install
cp config/.env.example .env   # optional — defaults work for local upstreams on 127.0.0.1
pnpm dev                      # :8080
```

Run upstream services (authentication, fleet, etc.) from the [IAG_multi_backend](https://github.com/alvor-technologies/IAG_multi_backend) meta-repo (`pnpm infra:up` or individual `dev:*` scripts).

## Environment

See [`config/.env.example`](config/.env.example). Key variables:

- `JWKS_URL`, `JWT_ISSUER` — authentication token verification
- `GATEWAY_INTERNAL_SECRET` — shared with upstreams using `AUTH_MODE=gateway`
- `UPSTREAM_*` — base URLs per service (set in Docker Compose / K8s per environment)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode |
| `pnpm build` | Build workspace packages + gateway |
| `pnpm test` | Policy unit tests |
| `pnpm start` | Production entry (`dist/main.js`) |

## Shared libraries

`packages/*` vendors `@iag/auth-client`, `@iag/config`, `@iag/observability`, and `@iag/service-core` until [`iag-packages`](https://github.com/alvor-technologies/iag-packages) is published to GitHub Packages. Then replace `workspace:*` with pinned registry versions.

## Docker

```bash
docker build -t iag-api-gateway .
docker run --rm -p 8080:8080 \
  -e JWKS_URL=http://host.docker.internal:3001/.well-known/jwks.json \
  -e GATEWAY_INTERNAL_SECRET=dev-gateway-secret-min-16-chars \
  iag-api-gateway
```

## Meta-repo integration

This repository is registered in `IAG_multi_backend/subrepos.json` and linked as a git submodule at `shared/services/api-gateway` for local Docker Compose and documentation paths.

## License

Confidential programme material — Alvor Technologies until handover to Inspire Africa Group.
