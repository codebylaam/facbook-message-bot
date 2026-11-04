# Deploying

The production stack is `compose.prod.yaml`: Postgres, a one-shot migration, the
API, the worker, and Caddy serving the built web bundle on one origin. Quadlet comes
later, per `Plan.md`; the systemd units here are only for backups.

## 1. Environment

Copy `.env.example` to `.env` and fill it. Production needs at least:

```bash
POSTGRES_PASSWORD=<random>
DATABASE_URL=postgres://fbbot:<random>@postgres:5432/fbbot
DOMAIN=bot.example.com
WEB_ORIGIN=https://bot.example.com
BETTER_AUTH_URL=https://bot.example.com
BETTER_AUTH_SECRET=<openssl rand -hex 32>
TOKEN_ENC_KEY=<openssl rand -hex 32>
META_APP_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=<random>
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
CMD_API_KEY=...
```

`DATABASE_URL` must use the compose service name `postgres`, not `localhost`.
`WEB_ORIGIN` becomes the Caddy origin. It is comma separated, so a deployment can
allow more than one origin, but production needs only the one.

## 2. Bring it up

```bash
podman-compose -f compose.prod.yaml up -d --build
podman-compose -f compose.prod.yaml ps
```

`migrate` runs once and exits. `api` and `worker` wait for it to finish. If your
compose version ignores `service_completed_successfully`, run the migration by hand
first:

```bash
podman-compose -f compose.prod.yaml run --rm migrate
```

Seed the plans once:

```bash
podman exec -it fb-bot_api_1 bun run --cwd /app/packages/db src/seed.ts
```

Create an admin by adding `ADMIN_EMAIL=you@example.com` to the environment for that
run, then remove it.

## 3. TLS

Caddy asks Let's Encrypt for a certificate for `DOMAIN` as soon as the container
starts, which needs ports 80 and 443 reachable from the internet and a DNS record
that already points at the host. To try the stack without a domain, set `DOMAIN=:80`
and reach it over plain HTTP by IP. There is no ACME account email by default; add a
global `email` block to `apps/web/Caddyfile` if you want expiry notices.

## 4. Webhooks

Point Meta at `https://$DOMAIN/webhooks/meta` with `META_VERIFY_TOKEN`. Caddy sends
`/webhooks/*`, `/api/*` and `POST /data-deletion` to the API and everything else to
the static bundle.

During development use the tunnel instead:

```bash
podman-compose -f compose.dev.yaml --profile tunnel up -d cloudflared
```

## 5. Backups

`scripts/backup.sh` writes a compressed custom-format dump, verifies it can be listed,
and prunes dumps older than `RETENTION_DAYS` (default 14).

```bash
sudo install -m 755 scripts/backup.sh /opt/fb-bot/scripts/backup.sh
sudo cp deploy/fb-bot-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fb-bot-backup.timer
systemctl list-timers fb-bot-backup.timer
```

Restore:

```bash
podman exec -i fb-bot_postgres_1 psql -U fbbot -d fbbot -c 'drop schema public cascade; create schema public;'
# pgvector and pg_trgm are created by the migration, so restore into a fresh database
podman exec -i fb-bot_postgres_1 pg_restore -U fbbot -d fbbot --no-owner < /var/backups/fb-bot/<file>.dump
```

Then `bun run db:migrate` to apply anything newer than the dump.

## 6. Images

`apps/api/Dockerfile` and `apps/worker/Dockerfile` install production dependencies
only and run the TypeScript entry directly, because Bun runs it without a build step.
`apps/web/Dockerfile` builds the bundle with Vite and copies it into a `caddy:2-alpine`
image, so the API URL is empty at build time and every request stays relative.

## 7. What is not covered

- No log shipping: containers log JSON to stdout, so use `podman logs` or a journal
  driver.
- No horizontal scaling: the rate limiter and the reply debounce assume one worker.
- No automatic failover for Postgres; the volume is a single bind.

## 8. Local development over a tunnel

Facebook Login refuses to run from an http page (`FB.login` reports "can no longer
be called from http pages" and never calls back), so the browser has to load the app
over https. Run both servers on plain http and let a Cloudflare tunnel terminate TLS
in front of them:

```bash
bun run dev:api      # http://localhost:3000
bun run dev:web      # http://localhost:5173
cloudflared tunnel run --token "$CLOUDFLARED_TOKEN"
```

Add two public hostnames to that tunnel in the Cloudflare dashboard
(Zero Trust → Networks → Tunnels → your tunnel → Public Hostnames):

| Hostname                 | Service                 |
| ------------------------ | ----------------------- |
| `fb-bot.example.com`     | `http://localhost:5173` |
| `fb-bot-api.example.com` | `http://localhost:3000` |

Both origins are plain http, so the TLS and proxy settings stay on their defaults.
Leave Cloudflare Access off the API hostname: Meta's webhook `POST`s are server to
server and cannot complete an interactive login.

Then point the API at those origins in `apps/api/.env`:

```bash
WEB_ORIGIN=https://fb-bot.example.com
BETTER_AUTH_URL=https://fb-bot-api.example.com
```

and the web app at the API in `apps/web/.env`:

```bash
VITE_API_URL=https://fb-bot-api.example.com
VITE_ALLOWED_HOSTS=fb-bot.example.com
```

`VITE_ALLOWED_HOSTS` is required: Vite only installs its Host-header check when
`server.https` is off, which is the case here, so every request arriving through the
tunnel is rejected with `403 Blocked request` until the public hostname is listed.
Comma separate the names, or use a leading dot (`.example.com`) to allow subdomains.

Restart both servers and open `https://fb-bot.example.com`. The tunnel is also what
Meta reaches, so the same API hostname serves the webhook
(`https://fb-bot-api.example.com/webhooks/meta`) and the data deletion callback. Add
the domain to the Meta app's App Domains and `https://fb-bot.example.com/pages` to
its Valid OAuth Redirect URIs, per §3 of the runbook.

The `tunnel` profile in `compose.dev.yaml` runs the same connector in a container,
which is convenient when the API also runs there; on the host, `cloudflared` alone
is the shorter path.
