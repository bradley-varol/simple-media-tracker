/// <reference path="../pb_data/types.d.ts" />

// Recently deleted: the endpoints that move entries into the bin and back out,
// the guard that keeps seasons out of a binned series, and the job that
// empties what has waited long enough. The logic lives in
// recently-deleted.js, which each handler requires for itself — see the note at
// the top of http.pb.js about why nothing here can be shared at file scope.
//
// These are routes rather than plain record updates from the browser because a
// series and its seasons have to move together. Each request is one
// transaction, so a failure part of the way through leaves nothing half moved,
// and the grouping rules sit in one place instead of in every client.
//
// Each responds with what it changed, so the app can update its lists without
// fetching the library again: the records moved or restored, or the ids of
// those removed for good.

// Into the bin.
routerAdd("POST", "/api/recently-deleted/{id}", (e) => {
  const bin = require(`${__hooks}/recently-deleted.js`)
  let moved = []
  e.app.runInTransaction((txApp) => { moved = bin.moveToBin(e, txApp, e.request.pathValue("id")) })
  return e.json(200, moved)
}, $apis.requireAuth())

// Back out of it.
routerAdd("POST", "/api/recently-deleted/{id}/restore", (e) => {
  const bin = require(`${__hooks}/recently-deleted.js`)
  let restored = []
  e.app.runInTransaction((txApp) => { restored = bin.restore(e, txApp, e.request.pathValue("id")) })
  return e.json(200, restored)
}, $apis.requireAuth())

// Out of the bin for good.
routerAdd("DELETE", "/api/recently-deleted/{id}", (e) => {
  const bin = require(`${__hooks}/recently-deleted.js`)
  let removed = []
  e.app.runInTransaction((txApp) => { removed = bin.removeForGood(e, txApp, e.request.pathValue("id")) })
  return e.json(200, removed)
}, $apis.requireAuth())

// Everything in it, for good.
routerAdd("DELETE", "/api/recently-deleted", (e) => {
  const bin = require(`${__hooks}/recently-deleted.js`)
  let removed = []
  e.app.runInTransaction((txApp) => { removed = bin.empty(e, txApp) })
  return e.json(200, removed)
}, $apis.requireAuth())

// A season cannot join a series that is in the bin. See refuseBinnedSeries.
onRecordCreateRequest((e) => {
  require(`${__hooks}/recently-deleted.js`).refuseBinnedSeries(e)
  return e.next()
}, "media_entries")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/recently-deleted.js`).refuseBinnedSeries(e)
  return e.next()
}, "media_entries")

// Hourly, so an entry goes within an hour of its 30 days rather than up to a
// day late. The query is one indexed lookup that usually finds nothing.
cronAdd("recentlyDeletedPurge", "0 * * * *", () => {
  const bin = require(`${__hooks}/recently-deleted.js`)
  $app.runInTransaction((txApp) => {
    const removed = bin.purgeExpired(txApp)
    if (removed > 0) txApp.logger().info("Removed expired entries from Recently deleted", "count", removed)
  })
})
