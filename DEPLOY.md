# Deploying MediLedger

Two routes, depending on whether you need the blockchain live.

| | Fabric | Cost | Guide |
|---|---|---|---|
| **Railway + Cloudflare Pages** | No | free–$5/mo | [below](#route-a--railway--cloudflare-pages) |
| **Single Docker host** | **Yes** | VM cost | [below](#route-b--single-docker-host) |

Railway cannot run Fabric — the ledger is five containers that must resolve
each other by hostname with matching TLS certificates. Route A therefore runs
with `FABRIC_ENABLED=false` and consent stored in Postgres only; keep Route B
locally for demonstrating the ledger.

---

# Route A — Railway + Cloudflare Pages

```
Cloudflare Pages  ──►  Railway (backend + Postgres)  ──►  Pinata (IPFS)
   frontend                      API
```

## A1. Postgres on Railway

New project → **Add service → Database → PostgreSQL**. Railway provisions it
with a volume and exposes `DATABASE_URL` as a shared variable.

## A2. Backend on Railway

**Add service → GitHub repo**, select this repository, then in service
settings set **Root Directory** to `Backend`. Railway picks up
`Backend/railway.json` and builds from the Dockerfile, using `/health` as the
healthcheck.

Set these variables on the backend service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — references the database service |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `FILE_SECRET` | `openssl rand -base64 32` |
| `WALLET_SECRET` | `openssl rand -base64 32` |
| `PINATA_JWT` | from Pinata, see A3 |
| `CORS_ORIGIN` | your Pages URL, set after A4 |
| `FABRIC_ENABLED` | `false` |

Do not set `PORT` — Railway injects it, and the server already reads it.

Migrations run automatically: the Dockerfile's command is
`prisma migrate deploy && tsx src/index.ts`.

Then **Settings → Networking → Generate Domain** to get the public API URL.

## A3. IPFS via Pinata

Railway cannot run a kubo sidecar, so storage goes to Pinata. Sign up, create
an API key with `pinFileToIPFS` permission, and copy the **JWT** into
`PINATA_JWT`. Setting that variable switches the driver automatically — no
code change.

Files are encrypted with AES-256-GCM before upload, so Pinata only ever holds
ciphertext.

## A4. Frontend on Cloudflare Pages

**Workers & Pages → Create → Pages → Connect to Git**, then:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_URL` = your Railway domain, e.g. `https://mediledger-api.up.railway.app` |

`VITE_API_URL` must be set **before** the first build — Vite inlines it into
the bundle, so changing it later needs a fresh deploy, not a restart.

`frontend/public/_redirects` handles SPA routing, so `/patient` and `/login`
survive a refresh.

## A5. Close the loop

Set `CORS_ORIGIN` on the Railway backend to the Pages URL
(`https://your-project.pages.dev`), with no trailing slash. The two are on
different origins, so this is load-bearing — unlike Route B, where one proxy
fronts both.

Redeploy the backend, then check:

```bash
curl -s https://your-api.up.railway.app/health      # {"status":"ok"}
curl -s https://your-api.up.railway.app/hospitals   # two seeded hospitals
```

Open the Pages URL and create an account.

### Known limits of Route A

- **No ledger.** The audit trail returns "Blockchain ledger is not enabled",
  and consent is only as tamper-evident as the database.
- Railway's free allowance is small and shared between the backend and
  Postgres; the Hobby plan is $5/month with matching credit.
- Pinata's free tier caps storage and requests.

---

# Route B — single Docker host


Everything runs from one Docker host. Caddy sits in front, terminates TLS and
serves the app and the API from a single origin.

```
          :443
            │
         ┌──▼───┐   /api/*   ┌─────────┐
         │ Caddy├───────────►│ backend │──► postgres
         └──┬───┘            └────┬────┘──► ipfs
            │ /                   │
      ┌─────▼────┐                └──────► fabric  (optional)
      │ frontend │
      └──────────┘
```

Only Caddy binds a public port. The backend, frontend and Postgres are bound to
loopback and reachable solely over the Compose network.

---

## 1. What you need

- A Linux host with **4 GB RAM minimum**, 8 GB if you want the ledger as well.
  Fabric adds two peers, an orderer and two CAs.
- Docker Engine with the Compose plugin.
- Optional but recommended: a domain name. Point an **A record** at the
  server's IP. Caddy then obtains and renews a certificate by itself.

Without a domain you can still run on plain HTTP by setting `DOMAIN=:80`.

### On AWS EC2

Launch an instance with:

| Setting | Value |
|---|---|
| AMI | Ubuntu Server 24.04 LTS |
| Instance type | **t3.medium** (2 vCPU / 4 GB) — `t3.micro` is 1 GB and too small for Fabric |
| Storage | 30 GB gp3 |
| Key pair | create one, keep the `.pem` |

**Security group inbound rules** — this is the step people miss:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | your IP |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

Ports 80 and 443 must be open to the world *before* Caddy starts, or its
certificate challenge fails and you get a TLS error that looks like a DNS
problem.

Then **allocate an Elastic IP and associate it** with the instance. Without
one the public IP changes on every stop/start and your DNS record goes stale.

Connect with:

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>
```

Set a billing alarm while you are in the console: the free plan for new
accounts is $200 of credits over 6 months, and a t3.medium is roughly
$30/month.

## 2. Install Docker

On a fresh Ubuntu box:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker          # or log out and back in
```

Open the web ports if a firewall is active:

```bash
sudo ufw allow 80,443/tcp
```

## 3. Get the code

```bash
git clone https://github.com/kartikSingh28/MEDILEDGER-saaS.git
cd MEDILEDGER-saaS
```

## 4. Configure

Two env files, neither committed.

**Deployment settings** at the repo root:

```bash
cp .env.production.example .env
nano .env
```

Set `DOMAIN`, `CORS_ORIGIN` and `VITE_API_URL` to your address, and generate a
Postgres password with `openssl rand -base64 24`.

**Backend secrets** at `Backend/.env`:

```bash
cp Backend/.env.example Backend/.env
```

Generate a fresh value for each of these — never ship the `change-me`
defaults, and never reuse your local ones:

```bash
for k in JWT_SECRET FILE_SECRET WALLET_SECRET; do
  echo "$k=$(openssl rand -base64 32)"
done
```

Paste them into `Backend/.env`. A few notes on what they do:

- `FILE_SECRET` encrypts every record file. **If you lose or change it, every
  stored record becomes unreadable** — there is no recovery path.
- `WALLET_SECRET` encrypts users' Fabric private keys at rest. Changing it
  forces every user to re-enrol.
- `DATABASE_URL` and `IPFS_NODE_URL` in that file are ignored in Docker;
  Compose overrides both to point at the containers.

## 5. Start it

Without the ledger — consent is stored in Postgres only:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The backend applies database migrations on start, so there is no separate
migration step.

## 6. Check it

```bash
curl -s https://your-domain/api/health        # {"status":"ok"}
curl -s https://your-domain/api/hospitals     # the two seeded hospitals
docker compose ps                             # all services healthy
docker compose logs -f backend
```

Then open `https://your-domain` and create an account.

---

## 7. Turning the ledger on

This is what makes consent tamper-evident, so it is worth the extra setup.

Install the Fabric binaries and samples **on the same host** (the Compose
overlay joins the backend to the network the test-network creates):

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.9 docker samples binary
```

That puts `fabric-samples` in the current directory. `blockchain/network/network.sh`
looks for it at `$HOME/fabric-samples`; point `FABRIC_SAMPLES` elsewhere if you
put it somewhere else. It also needs `jq`.

Bring the network up and deploy the chaincode:

```bash
cd blockchain/network
./network.sh up          # creates the channel, CAs, and deploys the contract
cd ../..
```

Then restart the stack with the Fabric overlay and `FABRIC_ENABLED=true`:

```bash
sed -i 's/^FABRIC_ENABLED=.*/FABRIC_ENABLED=true/' .env
docker compose -f docker-compose.yml \
               -f docker-compose.fabric.yml \
               -f docker-compose.prod.yml up -d --build
```

If you already had accounts and records from a Postgres-only run, backfill them
onto the ledger:

```bash
docker compose exec backend npm run fabric:sync
```

Verify by uploading a record and opening its **History** — you should see
`RECORD_REGISTERED` with a transaction ID.

---

## 8. Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Rebuilding is required for frontend changes: Vite inlines `VITE_API_URL` at
build time, so a restart alone will not pick up a new API address.

## 9. Backups

Everything that matters lives in two volumes:

```bash
docker run --rm -v mediledger_postgres-data:/d -v "$PWD":/b alpine \
  tar czf /b/postgres-$(date +%F).tar.gz -C /d .
docker run --rm -v mediledger_ipfs-data:/d -v "$PWD":/b alpine \
  tar czf /b/ipfs-$(date +%F).tar.gz -C /d .
```

Back up `Backend/.env` too, somewhere safe. Without `FILE_SECRET` the record
files in that IPFS volume cannot be decrypted.

---

## Troubleshooting

**Caddy will not get a certificate.** The A record must resolve to this server
and ports 80 and 443 must be reachable from the internet before Caddy can pass
the ACME challenge. Check with `docker compose logs caddy`.

**"Can't reach the MediLedger server" in the browser.** `VITE_API_URL` was
wrong at build time. Fix it in `.env` and rebuild with `--build` — a restart
will not do.

**Port 80 already in use.** Something else (often Apache or nginx) holds it:
`sudo lsof -i :80`, then stop it or change Caddy's published port.

**Audit trail says the ledger is not enabled.** `FABRIC_ENABLED` is still
`false`, or the Fabric overlay was not included in the `up` command.

**Backend restarts in a loop.** Usually a missing secret. `docker compose logs
backend` will name it — `FILE_SECRET must be set` and `WALLET_SECRET must be
set` are the common ones.
