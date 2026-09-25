# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub's private vulnerability reporting](https://github.com/bradley-varol/simple-media-tracker/security/advisories/new)
rather than opening a public issue.

Include the version you are running, how the instance is exposed (localhost,
LAN, reverse proxy), and the steps to reproduce. Expect an initial response
within a week. This is a hobby project maintained in spare time, so please be
patient with fixes.

## Supported versions

Only the latest release receives security fixes.

## Security model

Simple Media Tracker is designed for **one trusted owner** running a personal
library, optionally shared read-only with the public.

- **The library is public to read by default.** Anonymous visitors can list and
  view every entry that is not marked hidden. This is intentional, and can be
  turned off in Settings.
- **Public viewing is enforced by the API rule, not the interface.** With it
  off, the `media_entries` read rule fails for anyone not signed in, so the REST
  API returns nothing rather than the frontend merely declining to draw it.
- **Entries marked hidden are visible only to logged-in accounts.** This is
  enforced by the PocketBase read rule, not by the interface, so hiding an entry
  genuinely removes it from the API response for guests. The rule is
  `@request.auth.id != "" || (@collection.app_settings.guestViewing = true && hidden = false && deleted = "" && @collection.app_settings.guestHiddenTypes:each != type)`.
- **Deleted entries are kept for 30 days, and only the owner can see them.**
  Deleting sets a `deleted` date instead of removing the record, and the read
  rule above refuses guests any entry that has one. Anything deleted stays in
  the database, and in backups, until it is restored, deleted for good from
  Settings, or removed by the hourly purge once its 30 days are up.
- **Nothing leaves the library except through the bin.** The `media_entries`
  delete rule is closed to everyone but superusers, and the create and update
  rules refuse any request that sets `deleted`
  (`@request.auth.id != "" && @request.body.deleted:isset = false`), so the
  plain records API can neither remove an entry outright nor stamp one to be
  purged early. That guards against mistakes rather than against the owner: a
  signed-in account can still empty the bin.
- **The Recently deleted endpoints answer to the collection's own rules.**
  `/api/recently-deleted` moves a series and its seasons in one transaction,
  which the records API cannot do, so it is a custom route. It requires a
  signed-in account and then checks every record it touches against the
  `media_entries` update rule — removing for good included, since the delete
  rule is closed — so tightening that rule in the dashboard tightens these
  routes as well.
- **Whole media types can be hidden from guests too**, through the same rule:
  `guestHiddenTypes` in `app_settings` lists them, and a guest is refused any
  entry whose type is in the list. The list itself is readable by guests, as
  every setting is, so a visitor can learn that games are hidden, but not
  which games.
- **All writes require authentication**, enforced by PocketBase API rules.
- **One account, and it holds the whole library.** The owner has full create,
  update and delete access to *every* entry and can see hidden ones, though a
  delete goes through Recently deleted, below. There is
  no restricted role to hand out, so the only two levels of access are
  anonymous read-only and complete control.
- **Registration is a one-time door, not an open one.** `POST /api/setup`
  creates the account you log into the tracker with, and only while none
  exists — checked and created inside a single transaction, so two requests
  arriving together cannot both win. It has to be unauthenticated: there is no
  account yet to authenticate as. It carries the same tightened rate limit as
  password auth (10 requests per 5 minutes) to compensate.

## Deployment expectations

The threat model assumes you follow the deployment guidance in the README:

- **One port serves everything**, the superuser dashboard at `/_/` included,
  and that dashboard grants full database access — every record, every API
  rule, and a backup containing every password hash. `compose.yaml` binds it to
  `127.0.0.1` for that reason. Exposing the app exposes the dashboard with it,
  so restrict the dashboard to the addresses you administer from before
  publishing anything:

  ```bash
  pocketbase superuser ips 127.0.0.1 203.0.113.7
  ```

- Anything reachable beyond localhost is fronted by a TLS-terminating reverse
  proxy. Passwords and session tokens are sent in cleartext over plain HTTP.
- **The trusted proxy setting matches reality.** Behind a proxy every request
  arrives from the proxy's own address, which collapses the rate limiter into a
  single bucket and makes the IP allowlist above meaningless — so set the
  trusted proxy header to one your proxy *overwrites*, never one it merely
  appends to. With nothing proxying, leave it unset: an exposed instance would
  otherwise believe a header the client sends itself.
- MFA on a superuser account means a password **plus** a one-time code emailed
  to it — PocketBase has no authenticator-app option, and nothing here
  configures SMTP. Set up a mail server before enabling it, or the second
  factor is a `superuser otp` command rather than a login step. The IP
  allowlist is the control carrying the weight.

Issues that require an attacker to already have superuser dashboard access, or
that depend on the operator publishing an instance without restricting that
dashboard, are deployment misconfigurations rather than vulnerabilities in this
project.

## Known accepted risks

- The auth token is stored in `localStorage`, so any successful XSS against the
  app can exfiltrate an active session.
- Rate limiting is enabled on the auth endpoints by the initial migration, but a
  determined attacker with network access can still attempt slow brute force.
  Use a strong password.
- Whoever reaches a fresh instance's `POST /api/setup` first becomes the owner.
  Complete setup before exposing an instance beyond localhost.
- The superuser dashboard cannot be moved to a port of its own. PocketBase
  serves it from the same listener as the app, so the separation available is
  the IP allowlist rather than a port that is simply never published.
