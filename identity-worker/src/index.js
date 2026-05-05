// src/index.js
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const flagMatch = url.pathname.match(/^\/flags\/([A-Z]{2})$/i);
    if (flagMatch) {
      const country2 = flagMatch[1].toLowerCase();
      const object = await env.FLAGS.get(`${country2}.png`);
      if (!object) {
        return new Response("Flag not found", { status: 404 });
      }
      return new Response(object.body, {
        headers: { "Content-Type": "image/png" }
      });
    }
    const d1FlagMatch = url.pathname.match(/^\/flags-d1\/([A-Z]{2})$/i);
    if (d1FlagMatch) {
      const country2 = d1FlagMatch[1].toLowerCase();
      const result = await env.DB.prepare(
        "SELECT image_data FROM flags WHERE country_code = ?"
      ).bind(country2).first();
      if (!result) {
        return new Response("Flag not found in D1", { status: 404 });
      }
      const imageBuffer = Uint8Array.from(atob(result.image_data), (c) => c.charCodeAt(0));
      return new Response(imageBuffer, {
        headers: { "Content-Type": "image/png" }
      });
    }
    const email = request.headers.get("Cf-Access-Authenticated-User-Email") ?? "unauthenticated";
    const country = request.cf?.country ?? "XX";
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const body = `<!DOCTYPE html><html><body>
      <p>${email} authenticated at ${timestamp} from
        <a href="/flags/${country}">${country}</a>
      </p>
    </body></html>`;
    return new Response(body, { headers: { "Content-Type": "text/html" } });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
