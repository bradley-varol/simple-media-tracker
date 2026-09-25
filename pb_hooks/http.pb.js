/// <reference path="../pb_data/types.d.ts" />

// PocketBase serves the built frontend as well as the API, so the response
// headers a static file server would normally add have to be set here. This is
// the whole of what the old nginx container did.
//
// Everything these handlers need is declared inside them. Router middleware
// runs in a pooled JS runtime that does not share this file's scope, so a
// constant lifted to the top of the file is not defined by the time a request
// arrives — it fails at the first one, not at startup.

// Compress text responses. PocketBase streams realtime subscriptions from
// /api/realtime as server-sent events, and buffering a stream that is meant to
// arrive a line at a time would stall it, so that one path is left alone.
routerUse((e) => {
  if (e.request.url.path === "/api/realtime") {
    return e.next()
  }
  // $apis.gzip() hands back a handler record rather than a bare function, so
  // the middleware to run is its .func.
  return $apis.gzip().func(e)
})

routerUse((e) => {
  const path = e.request.url.path
  const headers = e.response.header()

  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Cross-Origin-Opener-Policy is not here because PocketBase has sent
  // same-origin itself since 0.40.0, on every path including /_/.

  // The superuser dashboard is PocketBase's own bundle, not ours, and it is not
  // built against this policy. Sending it the app's CSP would be guessing at
  // what a page we do not control needs.
  if (!path.startsWith("/_/")) {
    headers.set("X-Frame-Options", "DENY")
    // The app makes no third-party requests, so everything stays same-origin.
    headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
    ].join("; "))
  }

  // Vite emits asset filenames with a content hash, so a given URL's contents
  // can never change. index.html is the opposite: cache it and a browser pins
  // itself to an old build, pointing at asset URLs the new one no longer has.
  if (path.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
  } else if (!path.startsWith("/api/") && !path.startsWith("/_/")) {
    headers.set("Cache-Control", "no-cache")
  }

  return e.next()
})
