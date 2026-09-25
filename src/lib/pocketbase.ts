import PocketBase, { LocalAuthStore } from "pocketbase"

// Empty by default: the app talks to PocketBase over its own origin — served by
// PocketBase itself in production, proxied by the Vite dev server in
// development. Set VITE_POCKETBASE_URL only when hosting the API on a separate
// domain, which also requires configuring CORS in the PocketBase dashboard.
const url = import.meta.env.VITE_POCKETBASE_URL?.trim() || "/"

// Media records always live in PocketBase. Only the signed-in user's auth token
// is kept in the browser so the login survives a refresh.
export const pocketbase = new PocketBase(url, new LocalAuthStore("media-tracker:auth"))

// `authStore.isValid` only checks the token's own expiry claim, so a session
// that the server has since rejected — account deleted, password changed,
// database restored — still looks signed in until something actually fails.
// Clearing on the first 401 drops the app back to the logged-out view instead
// of leaving every write silently failing behind a working-looking interface.
pocketbase.afterSend = (response, data) => {
  if (response.status === 401 && pocketbase.authStore.isValid) {
    pocketbase.authStore.clear()
  }
  return data
}
