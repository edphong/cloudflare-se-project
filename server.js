const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {

  // Block direct access - only allow requests coming through Cloudflare
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (!cfConnectingIP) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied - Direct access not permitted');
    return;
  }

  // Extract the real client IP - Cloudflare passes this via X-Forwarded-For
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Log every incoming request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Client IP: ${clientIP}`);

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Main response
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'X-Origin-Server': 'my-railway-origin',
  });

  res.end('Hello from my origin server! NEW UPDATED');
});

server.listen(PORT, () => {
  console.log(`Origin server running on port ${PORT}`);
});