# Cloudflare Security Project — manifestflow.net

> **Context:** This project was built as a take-home technical assessment for the **Associate Solutions Engineer role at Cloudflare**. The assessment evaluates hands-on technical ability, independent learning, and the capacity to explain complex security concepts clearly to customers of varying technical backgrounds — from a small business owner with no IT team, to an enterprise security engineer.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [Part 1: Application Services](#part-1-application-services)
- [Part 2: Zero Trust](#part-2-zero-trust)
- [Part 3: Developer Platform](#part-3-developer-platform)
- [How to Run Locally](#how-to-run-locally)
- [How to Deploy](#how-to-deploy)
- [Testing the Security Rules](#testing-the-security-rules)

---

## Project Overview

This project demonstrates Cloudflare's product suite applied to a real, live web application. Every security layer has been implemented, tested, and documented with both technical evidence and plain-language explanations — because great security means nothing if you can't explain it to the person it's protecting.

**Stack:**
- Origin server: Node.js hosted on Railway.app
- Domain: manifestflow.net
- Security & Proxy: Cloudflare (Free plan)
- Tunnel: Cloudflare Tunnel (cloudflared)
- Identity: Cloudflare Zero Trust with GitHub SSO
- Edge compute: Cloudflare Workers + R2 + D1

---

## Live Demo

| Endpoint | Description |
|----------|-------------|
| https://www.manifestflow.net | Main site — proxied through Cloudflare |
| https://cloudflare-se-project-production.up.railway.app | Direct Railway URL — blocked (403) |
| https://www.manifestflow.net/secure | Zero Trust protected path — requires authentication |
| https://www.manifestflow.net/flags/AU | Country flag served from R2 bucket |
| https://www.manifestflow.net/flags-d1/AU | Country flag served from D1 database |

---

## Architecture

```
Visitor
   ↓
Cloudflare Edge (WAF, Rate Limiting, TLS, Zero Trust)
   ↓
Cloudflare Tunnel (encrypted, no exposed ports)
   ↓
Railway Origin Server (Node.js)
   ↓
Cloudflare Workers (identity + flag serving)
   ↓
R2 Bucket / D1 Database (flag assets)
```

Every visitor must pass through Cloudflare. There is no back door.

---

## Part 1: Application Services

### 1. Origin Server
The origin server is a Node.js HTTP server deployed on Railway.app, connected to this GitHub repository. Every push to `main` triggers an automatic deployment.

### 2. Web Application & Domain
The application is accessible at `www.manifestflow.net`. DNS is managed through Cloudflare with CNAME records pointing to the Railway deployment, all traffic proxied through Cloudflare's edge network.

### 3. Cloudflare Proxy
All DNS records are set to **Proxied (orange cloud)** in Cloudflare. This means:
- The origin server's real IP is never exposed
- All traffic passes through Cloudflare's global network
- Security rules, caching, and performance features apply automatically

### 4. TLS — Full (Strict) Mode
**Recommended encryption mode: Full (Strict)**

```
Visitor → (HTTPS) → Cloudflare → (HTTPS + verified cert) → Railway
```

Cloudflare offers four TLS modes. Full (Strict) is the only one that encrypts both legs of the journey AND verifies the origin certificate is legitimate — meaning even if someone discovers the origin server, they cannot impersonate it.

> **For a customer:** Think of Cloudflare as your fortified front gate. Flexible mode locks the front gate but leaves the back road to your server completely open. Full (Strict) means the entire journey — from your visitor to your server — is encrypted and verified. No gaps.

### 5. Managed Rulesets & SQL Injection Protection
**Cloudflare Managed Ruleset** is enabled under Security → Settings (Always Active).

The Managed Ruleset acts as a watchtower — scanning every incoming request against a continuously updated library of known attack patterns before they ever reach the origin server.

**SQL Injection demonstration:**

Testing with a known attack tool user agent:
```bash
curl -A "sqlmap/1.0" https://www.manifestflow.net
# Returns: Error 1010 — blocked by Managed Ruleset automatically
```

Testing with a SQL injection query string:
```
https://www.manifestflow.net/?search=1=1
# Returns: Cloudflare block page — blocked by custom WAF rule
```

> **Note on free tier:** Full OWASP Core Ruleset pattern matching requires Cloudflare Pro. On the free tier, a custom WAF rule was created to demonstrate the SQL injection blocking mechanism. This also illustrates why the OWASP ruleset matters at scale — manually maintaining rules for every SQL injection variant is impractical in production.

> **For a customer:** Without this protection, an attacker can send a specially crafted request that tricks your database into revealing all its data — or deleting it entirely. Cloudflare catches these attempts at the gate before they ever reach your server.

### 6. Rate Limiting
A rate limiting rule called **"Protect login endpoint"** has been configured:

```
Path:        /*
Requests:    10 per 10 seconds
Action:      Block
Duration:    1 minute
```

**Risk mitigated:** Brute force attacks and application-layer DDoS. Without rate limiting, an automated bot can attempt thousands of password combinations per minute, or flood your server with requests until it crashes.

**Demonstration:**
```bash
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://www.manifestflow.net; done
# Output: 200 200 200 ... 1015 1015 1015
# Error 1015 = You are being rate limited
```

> **For a customer:** Imagine someone standing at your gate knocking 500 times a minute. That's not a visitor — that's an attack. Rate limiting tells your guards: if anyone knocks more than 10 times in 10 seconds, turn them away for a minute. Your real visitors never notice. Attackers get stopped cold.

### 7. Blocking Direct Server Access
The origin server includes middleware that checks every incoming request for a Cloudflare-specific header:

```javascript
const cfConnectingIP = req.headers['cf-connecting-ip'];
if (!cfConnectingIP) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('Access denied - Direct access not permitted');
  return;
}
```

Cloudflare stamps every forwarded request with `cf-connecting-ip`. Direct requests to Railway bypass Cloudflare and arrive without this header — so they are immediately rejected.

**Demonstration:**
- Direct Railway URL: `cloudflare-se-project-production.up.railway.app` → **403 Access Denied**
- Via domain: `www.manifestflow.net` → **200 OK**

This establishes a **single point of ingress** — Cloudflare is the only way in, guaranteed.

> **For a customer:** You've invested in Cloudflare's protection — the rulesets, rate limiting, DDoS protection. Without this step, a single discovered server address bypasses all of it in one move. This step ensures that investment actually means something.

---

## Part 2: Zero Trust

### 1. Cloudflare Tunnel
Cloudflare Tunnel replaces the need for open ports or exposed server IPs entirely. Instead of the internet connecting to your server, your server digs an encrypted tunnel outward to Cloudflare.

```bash
# Tunnel status
sudo systemctl status cloudflared
# Active: active (running) — enabled on boot
# 4 registered connections to Sydney/Brisbane Cloudflare edge locations
```

Config file (`/etc/cloudflared/config.yml`):
```yaml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: www.manifestflow.net
    service: http://localhost:8080
  - service: http_status:404
```

> **For a customer:** Instead of leaving a back door in your castle wall, your castle digs a tunnel that reaches out to Cloudflare first. Nobody can attack a door that doesn't exist.

### 2. Identity Provider (SSO)
GitHub has been configured as the SSO Identity Provider within Cloudflare Zero Trust. Users authenticate via their GitHub account before accessing protected paths.

Setup path: `Zero Trust → Settings → Authentication → Add new IdP → GitHub`

### 3. Access Policy — /secure path
An Access Policy has been configured to protect the `/secure` path:

```
Application: www.manifestflow.net/secure
Rule:        Allow
Conditions:
  - Email: edwoodphong@gmail.com (owner)
  - Email domain: @cloudflare.com
```

Anyone else attempting to access `/secure` is presented with a Cloudflare Access login page and denied entry if their email doesn't match the policy.

---

## Part 3: Developer Platform

### 1 & 2. Cloudflare Worker — Identity + Flag Serving

A Cloudflare Worker serves the `/secure` endpoint and returns authenticated user identity:

```
"{EMAIL} authenticated at {TIMESTAMP} from {COUNTRY}"
```

Where `{COUNTRY}` is an HTML link to `/flags/{COUNTRY}` which serves the appropriate country flag from a private R2 bucket.

The Worker was created and deployed using the Wrangler CLI:
```bash
npx wrangler deploy
```

Example response at `/secure`:
```html
edwoodphong@gmail.com authenticated at 2026-05-04T10:23:01Z from <a href="/flags/AU">AU</a>
```

### 3. D1 Database — Flag Storage

A D1 SQLite database has been created and bound to the Worker as an alternative flag storage backend.

```sql
CREATE TABLE flags (
  country_code TEXT PRIMARY KEY,
  image_data   BLOB,
  content_type TEXT
);
```

Flags are accessible via `/flags-d1/{COUNTRY}` — retrieved from D1 and served with the appropriate image content type.

**Worker bindings (wrangler.toml):**
```toml
[[r2_buckets]]
binding = "FLAGS_BUCKET"
bucket_name = "country-flags"

[[d1_databases]]
binding = "FLAGS_DB"
database_name = "flags-db"
database_id = "<database-id>"
```

---

## How to Run Locally

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/cloudflare-se-project.git
cd cloudflare-se-project
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the server**
```bash
node server.js
```

Server runs on `http://localhost:3000`

---

## How to Deploy

**Railway (origin server):**
1. Push to GitHub — Railway auto-deploys on every push to `main`
2. Add custom domain in Railway → Settings → Networking

**Cloudflare Worker:**
```bash
npx wrangler deploy
```

**Cloudflare Tunnel:**
```bash
# Run manually
cloudflared tunnel run my-tunnel

# Or as a persistent background service
sudo systemctl start cloudflared
```

---

## Testing the Security Rules

| Test | Command | Expected Result |
|------|---------|----------------|
| SQL Injection (sqlmap) | `curl -A "sqlmap/1.0" https://www.manifestflow.net` | Error 1010 |
| SQL Injection (query string) | Visit `/?search=1=1` in browser | Cloudflare block page |
| Rate Limiting | `for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://www.manifestflow.net; done` | 200s then 1015 |
| Direct Access Block | Visit Railway URL directly in browser | 403 Access Denied |
| Zero Trust | Visit `/secure` without authentication | Cloudflare Access login |

---

## Project Structure

```
cloudflare-se-project/
├── server.js           # Origin server — Node.js HTTP
├── worker/
│   └── index.js        # Cloudflare Worker — identity + flags
├── wrangler.toml       # Worker config — R2 and D1 bindings
├── package.json
└── README.md
```
