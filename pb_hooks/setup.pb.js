/// <reference path="../pb_data/types.d.ts" />

// The account you log into the tracker with is created here, not from the
// PocketBase dashboard: a setup endpoint that works exactly once, the first
// time anyone calls it, and refuses every request after. Public registration
// stays closed — the users collection's own create rule is still null — this
// is the one narrow door around it, and it locks itself.
//
// GET tells the frontend whether to show the setup form or send straight to
// login, without needing to authenticate to find out: there is no account yet
// to authenticate as.
routerAdd("GET", "/api/setup", (e) => {
  return e.json(200, { needed: e.app.countRecords("users") === 0 })
})

routerAdd("POST", "/api/setup", (e) => {
  const data = new DynamicModel({ email: "", password: "" })
  e.bindBody(data)

  const email = String(data.email || "").trim()
  const password = String(data.password || "")

  if (!email || !password) {
    throw new BadRequestError("Email and password are required.")
  }

  // Checking and creating have to happen inside one transaction. Two requests
  // arriving together could otherwise both pass the "is anyone here yet"
  // check before either had saved — the same first-run race an installer like
  // WordPress's accepts. PocketBase serializes writes within a transaction, so
  // doing both inside one closes it: the second request's transaction waits
  // for the first to commit, then sees the account that just landed and backs
  // off on its own.
  let created = false
  e.app.runInTransaction((txApp) => {
    if (txApp.countRecords("users") > 0) return

    const users = txApp.findCollectionByNameOrId("users")
    const owner = new Record(users)
    owner.setEmail(email)
    owner.setPassword(password)
    // Nothing in the app sends mail, so there is no verification step to
    // complete, and an unverified account would just be a flag nobody could
    // ever clear.
    owner.setVerified(true)
    txApp.save(owner)
    created = true
  })

  if (!created) {
    throw new NotFoundError("Setup has already completed.")
  }

  return e.json(200, { success: true })
}, $apis.bodyLimit(4096))
