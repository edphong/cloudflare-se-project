# Cloudflare SE Take-Home Assessment
**Candidate:** Ed Phong  
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

Visitor
  │
  ▼
Cloudflare Edge (WAF, Rate Limiting, TLS)
  │
  ├── www.manifestflow.net
  │     │
  │     └── Cloudflare Tunnel → Origin Server (Railway)
  │           └── /secure → Protected by Cloudflare Access (GitHub SSO)
  │
  └── identity-worker.edphong.workers.dev
        │
        ├── /              → Identity string (email, timestamp, country)
        ├── /flags/:cc     → Country flag from private R2 bucket
        └── /flags-d1/:cc  → Country flag from D1 database
        
---

## Live Demo

### Origin Server
| Endpoint | Description |
|----------|-------------|
| `https://www.manifestflow.net` | Main site — proxied through Cloudflare |
| `https://cloudflare-se-project-production.up.railway.app` | Direct Railway URL — blocked (403) |
| `https://www.manifestflow.net/secure` | Zero Trust protected path — requires GitHub authentication |

### Cloudflare Worker
| Endpoint | Description |
|----------|-------------|
| `https://identity-worker.edphong.workers.dev` | Identity string — email, timestamp, country |
| `https://identity-worker.edphong.workers.dev/flags/AU` | Country flag served from private R2 bucket |
| `https://identity-worker.edphong.workers.dev/flags-d1/AU` | Country flag served from D1 database |

---

## Authentication

The `/secure` path is protected by Cloudflare Access with GitHub SSO.

Only the following identities are permitted:
- `edwoodphong@gmail.com`
- Any `@cloudflare.com` email address

To test access as an authorised user, use the provided test GitHub account credentials included in the submission email.

All other identities will receive a Cloudflare Access **denied** page.

---

## Project Structure

cloudflare-se-project/
├── server.js
├── identity-worker/
│   ├── src/
│   │   └── index.js
│   ├── schema.sql
│   ├── seed.js
│   └── wrangler.jsonc
└── README.md

---

## Setup & Deployment

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Zero Trust and R2 enabled

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
```bash
npx wrangler r2 bucket create flag-images

cd ../png1000px
for f in *.png; do
  npx wrangler r2 object put "flag-images/$f" --file "$f" --remote
done
```

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

### 6. Deploy Worker
```bash
cd identity-worker
npx wrangler deploy
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