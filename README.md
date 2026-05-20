# iag-api-gateway

IAG platform **API gateway** — single application ingress for microservices. Verifies JWTs against authentication JWKS, enforces route policies in `src/policies.ts`, forwards principal headers to upstreams, and reverse-proxies HTTP to platform services.

**Edge stack:** run **nginx** in front for TLS, connection limits, and transport hardening; this service owns JWT, RBAC, and routing.

| Item | Value |
|------|-------|
| Port (direct) | 8080 |
| Port (via nginx Compose) | 8080 → nginx → gateway |
| Health | `GET /health`, `GET /ready` |
| Route registry | `src/routes.ts` (`UPSTREAM_*`) |
| Auth policies | `src/policies.ts` |

## Architecture

```
Client → nginx (edge: rate limit, TLS, strip X-IAG-*) → iag-api-gateway (JWT + policies) → microservices
```

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 9+

## Quick start

```bash
pnpm install
cp config/.env.example .env
pnpm dev    # http://localhost:8080
```

Run upstream services from [IAG_multi_backend](https://github.com/alvor-technologies/IAG_multi_backend) (`pnpm infra:up`).

### With nginx (Docker)

```bash
docker compose -f deploy/docker-compose.yml up -d --build
# http://localhost:8080 → nginx → gateway
```

## Environment

See [`config/.env.example`](config/.env.example).

| Variable | Purpose |
|----------|---------|
| `JWKS_URL`, `JWT_ISSUER` | Token verification |
| `JWT_AUDIENCE` | Optional `aud` check when tokens include it |
| `GATEWAY_INTERNAL_SECRET` | Required in production (≥16 chars); matches upstream `AUTH_MODE=gateway` |
| `TRUST_PROXY` | `true` behind nginx / load balancer |
| `READY_PROBE_UPSTREAMS` | `true` to probe each upstream `/ready` on gateway `/ready` |
| `RATE_LIMIT_MAX` / `OAUTH_RATE_LIMIT_MAX` | Per-IP limits at the gateway |
| `UPSTREAM_*` | Service base URLs |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode |
| `pnpm build` | Build workspace packages + gateway |
| `pnpm test` | Policy + coverage tests |
| `pnpm start` | Production (`dist/main.js`) |

## Hardening (implemented)

- **Default deny** on proxied paths without a policy (`403 no_route_policy`)
- **Strip** inbound `X-IAG-*` headers (clients cannot spoof principal)
- **Request ID** — `X-Request-Id` / `X-Correlation-Id` propagated to upstreams
- **Graceful shutdown** — `SIGINT` / `SIGTERM` with 30s drain
- **Rate limiting** — global + stricter OAuth token path
- **Production config** — enforces `GATEWAY_INTERNAL_SECRET` when `NODE_ENV=production`
- **Policy coverage tests** — CI fails if sample paths lack policies
- **nginx** — `deploy/nginx/` for edge proxy (see `deploy/docker-compose.yml`)

## Shared libraries

`packages/*` vendors `@iag/*` until [iag-packages](https://github.com/alvor-technologies/iag-packages) is published. Replace `workspace:*` with pinned registry versions when ready.

## Docker

```bash
docker build -t iag-api-gateway .
```

## Meta-repo

Registered in `IAG_multi_backend/subrepos.json`. Clone as sibling:

```
GitHub/
├── IAG_multi_backend/
└── iag-api-gateway/
```

## License

Confidential programme material — Alvor Technologies until handover to Inspire Africa Group.
