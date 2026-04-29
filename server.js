// server.js
const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {

  // Extract the real client IP - Cloudflare passes this via X-Forwarded-For
  // Without this, we'd only ever see Cloudflare's IP, not the real user's
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Log every incoming request - useful for showing live in Railway's log stream during demo
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Client IP: ${clientIP}`);

  // Health check endpoint - confirms server is alive to Cloudflare and Railway
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Main response
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    // This custom header proves in your demo that the response is coming
    // from YOUR origin server, not from Cloudflare's cache
    'X-Origin-Server': 'my-railway-origin',
  });

  res.end('Hello from my origin server! NEW UPDATED');
});

server.listen(PORT, () => {
  console.log(`Origin server running on port ${PORT}`);
});