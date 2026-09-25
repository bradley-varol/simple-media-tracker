/// <reference path="../pb_data/types.d.ts" />

// PocketBase serves the app itself now, so nothing sits in front of it by
// default and there is no proxy header left to trust. Trusting one anyway is
// worse than useless on a directly exposed instance: a client can send its own
// X-Real-IP, and that header decides which rate limit bucket the request lands
// in and whether it may reach the superuser dashboard at all.
//
// Putting a TLS-terminating proxy in front brings the need back — every request
// then arrives from the proxy's address, which buckets every visitor together.
// Set the header your proxy *overwrites* (not one it merely appends to) under
// Settings → Application in the dashboard when you do.

migrate((app) => {
  const settings = app.settings()

  settings.trustedProxy.headers = []
  settings.trustedProxy.useLeftmostIP = false

  app.save(settings)
}, (app) => {
  const settings = app.settings()

  settings.trustedProxy.headers = ["X-Real-IP"]
  settings.trustedProxy.useLeftmostIP = false

  app.save(settings)
})
