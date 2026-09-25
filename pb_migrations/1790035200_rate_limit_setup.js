/// <reference path="../pb_data/types.d.ts" />

// pb_hooks/setup.pb.js adds POST /api/setup, the one door around closed
// registration: it creates the account you log into the tracker with, and
// only while none exists yet. It is unauthenticated by necessity — there is no
// account to authenticate as before the first one exists — so it gets the same
// tightened rate limit as password auth rather than the loose general "/api/"
// default, which permits far more attempts than typing your own password
// wrong ever needs.
const SETUP_RULE_LABEL = "POST /api/setup"

migrate((app) => {
  const settings = app.settings()

  settings.rateLimits.rules = [
    ...settings.rateLimits.rules.filter((rule) => rule.label !== SETUP_RULE_LABEL),
    { label: SETUP_RULE_LABEL, audience: "", duration: 300, maxRequests: 10 },
  ]

  app.save(settings)
}, (app) => {
  const settings = app.settings()

  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== SETUP_RULE_LABEL)

  app.save(settings)
})
