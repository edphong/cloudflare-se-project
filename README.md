# Cloudflare SE Take-Home Assessment
**Domain:** [www.manifestflow.net](https://www.manifestflow.net)  
**Worker:** [identity-worker.edphong.workers.dev](https://identity-worker.edphong.workers.dev)

---

## Overview

This project demonstrates a full Cloudflare implementation across three areas:
- **Application Services** — origin server proxied through Cloudflare with TLS, WAF, and rate limiting
- **Zero Trust** — Cloudflare Tunnel, GitHub SSO, and Access policies
- **Developer Platform** — Cloudflare Worker with R2 and D1 storage bindings

---

## Architecture

Traffic flows from the visitor through Cloudflare's edge (WAF, rate limiting, TLS) 
to either the origin server via Cloudflare Tunnel, or directly to the Cloudflare 
Worker. The `/secure` path on the origin server is protected by Cloudflare Access 
with GitHub SSO. The Worker serves identity information and country flags from 
either R2 or D1 depending on the endpoint.
        
---

### Origin Server
| Endpoint | Description |
|----------|-------------|
| `https://www.manifestflow.net` | Main site — proxied through Cloudflare |
| `https://cloudflare-se-project-production.up.railway.app` | Direct Railway URL — blocked (403) |
| `https://www.manifestflow.net/secure` | Zero Trust protected path — requires GitHub authentication |

## Demo — No Setup Required

All infrastructure is already deployed and live. To test:

| Step | URL | Expected Result |
|------|-----|-----------------|
| 1 | `https://www.manifestflow.net` | Main site loads |
| 2 | `https://cloudflare-se-project-production.up.railway.app` | Direct origin URL — blocked (403) |
| 3 | `https://www.manifestflow.net/secure` | GitHub login prompt appears |
| 4 | `https://identity-worker.edphong.workers.dev` | GitHub login → identity string displays |
| 5 | Click country link on identity page | Country flag loads from private R2 bucket |
| 6 | `https://identity-worker.edphong.workers.dev/flags/AU` | Australian flag from R2 |
| 7 | `https://identity-worker.edphong.workers.dev/flags/JP` | Japanese flag from R2 |
| 8 | `https://identity-worker.edphong.workers.dev/flags-d1/AU` | Australian flag from D1 |
| 9 | `https://identity-worker.edphong.workers.dev/flags-d1/JP` | Japanese flag from D1 |

### Test Account

A test GitHub account has been provided for authentication testing.
Credentials are included in the submission email.

Only the following identities are permitted through the Access policy:
- Test Account Provided
- Any `@cloudflare.com` email address

All other identities will receive a Cloudflare Access **denied** page.

---

## Setup & Deployment — For Running Your Own Instance

Only required if you want to clone and deploy your own version.

> **Note:** The seeding scripts use bash syntax. 
> Windows users should run these commands in WSL or Git Bash.

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Zero Trust, R2, and D1 enabled
- Flag PNG assets (256 country flags, 1000px)

### 1. Clone the repository
```bash
git clone https://github.com/edphong/cloudflare-se-project
cd cloudflare-se-project
```

### 2. Install dependencies
```bash
npm install
cd identity-worker && npm install
```

### 3. Authenticate with Cloudflare
```bash
npx wrangler login
```

### 4. Create R2 bucket and upload flags

Create a folder called `png1000px` in your project root and add your flag PNG files there, then:

```bash
npx wrangler r2 bucket create flag-images

cd png1000px
for f in *.png; do
  npx wrangler r2 object put "flag-images/$f" --file "$f" --remote
done
```

> **Note:** Replace `flag-images` with a unique bucket name if this one already exists in your Cloudflare account. If you change the bucket name, update the `binding` in `identity-worker/wrangler.jsonc` to match.

### 5. Create D1 database and seed flags
```bash
cd ../identity-worker

npx wrangler d1 create flag-database

npx wrangler d1 execute flag-database --remote --file=./schema.sql

node seed.js

for f in seed-batch-*.sql; do
  npx wrangler d1 execute flag-database --remote --file="./$f" --yes
done
```

> **Note:** Some larger flag images may fail with `SQLITE_TOOBIG` during seeding.
> This is a known D1 limitation with binary data — see Known Limitations section for details.

### 6. Deploy Worker
```bash
cd identity-worker
npx wrangler deploy
```

### 7. Configure Cloudflare Access
In the Cloudflare Zero Trust dashboard:
- Add GitHub as an Identity Provider under `Integrations → Identity providers`
- Create a self-hosted application for `identity-worker.<your-subdomain>.workers.dev`
- Add an access policy allowing your email and `@cloudflare.com` domain

### 8. Configure Cloudflare Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create my-tunnel
cloudflared tunnel route dns my-tunnel www.yourdomain.com
sudo cloudflared --config ~/.cloudflared/config.yml service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Cloudflare Tunnel

The origin server is connected to Cloudflare via a persistent tunnel running as a systemd service on the host machine.

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Restart tunnel if needed
sudo systemctl restart cloudflared
```

Tunnel config lives at `~/.cloudflared/config.yml` and routes `www.manifestflow.net` to `localhost:8080`.

---

## Known Limitations & Notes

### D1 SQLITE_TOOBIG
When seeding flag images into D1, base64 encoding PNG files increases their size by ~33%. This caused `SQLITE_TOOBIG` errors when inserting larger flag images as single SQL statements.

**Workaround:** Batched inserts into groups of 10 flags per SQL file via `seed.js`.

**Architectural note:** D1 is designed for structured metadata, not binary asset storage. The correct production pattern is:
- R2 → store binary image files
- D1 → store metadata (country code, filename, size)

This limitation was encountered and documented as a learning outcome during implementation.

---

## Tech Stack

| Product | Usage |
|---------|-------|
| Cloudflare Tunnel | Secure origin connection — no open ports |
| Cloudflare Access | Zero Trust SSO with GitHub IdP |
| Cloudflare WAF | Managed rulesets + SQL injection protection |
| Cloudflare Workers | Edge compute — identity and flag endpoints |
| Cloudflare R2 | Private binary object storage for flag images |
| Cloudflare D1 | SQLite edge database for flag metadata |
| Node.js | Origin server |
| Railway | Origin server hosting |
| GitHub OAuth | Identity provider for SSO |