# Cloudflare Security Project — manifestflow.net

This project was built as a take-home technical assessment for the **Associate Solutions Engineer role at Cloudflare**. The assessment was designed to evaluate hands-on technical ability, independent learning, and the capacity to explain complex security concepts clearly to customers of varying technical backgrounds.

The brief required setting up a live origin server, securing it end-to-end using Cloudflare's product suite, and documenting each step with real demonstrations and customer-facing explanations.

---

## What This Project Does

This project sets up a web server and secures it using Cloudflare. It demonstrates:

- Proxying traffic through Cloudflare
- TLS encryption between Cloudflare and the origin server
- Managed Rulesets and SQL injection protection
- Rate limiting to prevent brute force attacks
- Blocking direct access to the origin server

---

## Prerequisites

Before running this project you will need:

- A [Railway](https://railway.app) account (free)
- A [Cloudflare](https://dash.cloudflare.com) account (free)
- A domain name pointed to Cloudflare's nameservers
- [Node.js](https://nodejs.org) installed on your machine
- [Git](https://git-scm.com) installed on your machine

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

The server will run on `http://localhost:3000`

---

## How to Deploy to Railway

**1.** Push this repository to GitHub

**2.** Go to [Railway](https://railway.app) → New Project → Deploy from GitHub

**3.** Select this repository — Railway will auto-deploy on every push to main

**4.** Your app will be live at a Railway URL like:
```
cloudflare-se-project-production.up.railway.app
```

---

## Cloudflare Setup

### Step 1 — Add your domain to Cloudflare
- Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
- Add your domain and update your registrar's nameservers to Cloudflare's

### Step 2 — Point DNS to Railway
Go to DNS → Records and add:
```
Type:    CNAME
Name:    www
Content: your-app.up.railway.app
Proxied: ON (orange cloud)
```

### Step 3 — Enable Full (Strict) TLS
```
SSL/TLS → Overview → Full (Strict)
```
This ensures all traffic between Cloudflare and your server is encrypted and verified.

### Step 4 — Enable Managed Ruleset
```
Security → Settings → Cloudflare Managed Ruleset → Always Active
```
This automatically blocks known attacks including bots, DDoS, and web exploits.

### Step 5 — Create Rate Limiting Rule
```
Security → Security Rules → Create Rule → Rate Limiting Rule
```
Configure:
```
Name:     Protect login endpoint
Path:     /*
Requests: 10
Period:   10 seconds
Action:   Block
Duration: 1 minute
```

### Step 6 — Create SQL Injection Custom Rule
```
Security → Security Rules → Create Rule → Custom Rule
```
Configure:
```
Name:     Block SQL Injection
Field:    URI Query String
Operator: contains
Value:    1=1
Action:   Block
```

---

## Testing the Security Rules

### Test SQL Injection Blocking
Open a browser and visit:
```
https://www.yourdomain.com/?search=1=1
```
Expected result: Cloudflare block page

### Test sqlmap Detection
Open terminal and run:
```bash
curl -A "sqlmap/1.0" https://www.yourdomain.com
```
Expected result: Error 1010 — Access Denied

### Test Rate Limiting
Open terminal and run:
```bash
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://www.yourdomain.com; done
```
Expected result: 200 responses followed by 1015 (rate limited)

### Test Direct Access Blocking
Visit your Railway URL directly in a browser:
```
https://your-app.up.railway.app
```
Expected result: "Access denied - Direct access not permitted"

---

## How Direct Access is Blocked

The server checks every incoming request for a Cloudflare header:

```javascript
const cfConnectingIP = req.headers['cf-connecting-ip'];
if (!cfConnectingIP) {
  res.writeHead(403);
  res.end('Access denied - Direct access not permitted');
  return;
}
```

Cloudflare stamps every request it forwards with `cf-connecting-ip`. Requests arriving directly to Railway without this header are immediately blocked.

---

## Project Structure

```
cloudflare-se-project/
├── server.js        # Main server file
├── package.json     # Node.js dependencies
└── README.md        # This file
```

---

## Live Demo

- **Live site:** https://www.manifestflow.net
- **Direct Railway URL (blocked):** https://cloudflare-se-project-production.up.railway.app
