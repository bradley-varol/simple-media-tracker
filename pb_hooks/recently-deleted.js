/// <reference path="../pb_data/types.d.ts" />

// The workings of Recently deleted, shared by the routes and the purge in
// recently-deleted.pb.js. Handlers there run in a pooled JS runtime that does
// not share that file's scope, so each one requires this module rather than
// reaching for a function defined beside it.
//
// An entry is in the bin when its `deleted` date is set. A series goes in with
// its seasons, all stamped with the same instant, and that shared stamp is how
// it comes back out with the same seasons and not ones deleted on their own
// before it. See 1790467200_recently_deleted.js for the field itself.

/**
 * How long an entry waits before it is removed for good. The Settings page
 * counts down from the same number, so change BIN_DAYS in src/lib/media.ts
 * alongside it.
 */
const RETENTION_DAYS = 30

const COLLECTION = "media_entries"

function isBinned(record) {
  return record.getString("deleted") !== ""
}

function isSeason(record) {
  return record.getString("parent") !== ""
}

/**
 * The entry the route names, if it is in the state the route needs. An id that
 * does not exist and an entry in the wrong place answer the same, so neither
 * says more about the library than the other.
 */
function findEntry(app, id, binned) {
  let record
  try {
    record = app.findRecordById(COLLECTION, id)
  } catch {
    record = null
  }
  if (!record || isBinned(record) !== binned) {
    throw new NotFoundError(binned ? "That entry is not in Recently deleted." : "That entry is not in the library.")
  }
  return record
}

/** The seasons that went into the bin in the same move as their series. */
function binnedWith(app, series) {
  return app.findRecordsByFilter(
    COLLECTION,
    "parent = {:id} && deleted = {:deleted}",
    "", 0, 0,
    { id: series.id, deleted: series.getString("deleted") },
  )
}

/** Drops repeats, keeping the first of each, so a record is written once. */
function unique(records) {
  const seen = {}
  return records.filter((record) => {
    if (seen[record.id]) return false
    seen[record.id] = true
    return true
  })
}

/**
 * Seasons ahead of everything else. Removing a series unlinks any season still
 * pointing at it, which is a pointless write when the season is about to go in
 * the same breath.
 */
function seasonsFirst(records) {
  return records.filter(isSeason).concat(records.filter((record) => !isSeason(record)))
}

/**
 * Holds a route to the collection's update rule, so these endpoints never let
 * through a request that the plain records API would refuse, and tightening
 * that rule in the dashboard tightens them too.
 *
 * Removing for good answers to the update rule as well. The delete rule is
 * closed to everyone but superusers, so that nothing leaves the library
 * without passing through the bin, which leaves only the update rule to say
 * who manages the library.
 */
function authorize(e, app, record) {
  if (e.hasSuperuserAuth()) return
  const rule = record.collection().updateRule
  if (rule === null || !app.canAccessRecord(record, e.requestInfo(), rule)) {
    throw new ForbiddenError("You are not allowed to change this entry.")
  }
}

function setDeleted(e, app, records, value) {
  for (const record of records) {
    authorize(e, app, record)
    record.set("deleted", value)
    app.save(record)
  }
}

function destroy(e, app, records) {
  for (const record of seasonsFirst(unique(records))) {
    authorize(e, app, record)
    app.delete(record)
  }
}

/**
 * Moves an entry into the bin. A series takes every season still in the
 * library with it, all under one stamp.
 */
function moveToBin(e, app, id) {
  const entry = findEntry(app, id, false)
  const group = [entry]
  if (!isSeason(entry)) {
    group.push(...app.findRecordsByFilter(COLLECTION, 'parent = {:id} && deleted = ""', "", 0, 0, { id: entry.id }))
  }
  setDeleted(e, app, group, new DateTime())
  return group
}

/**
 * Puts an entry back. A series brings back the seasons that went with it. A
 * season brings back its series if that is in the bin too — a season is part
 * of a series, and returning it to one that is not in the library would leave
 * it standing on its own — and the series brings its own seasons as usual.
 */
function restore(e, app, id) {
  const entry = findEntry(app, id, true)
  const heads = [entry]

  if (isSeason(entry)) {
    // A series removed for good unlinks its seasons, so a parent that is still
    // named is still there.
    const series = app.findRecordById(COLLECTION, entry.getString("parent"))
    if (isBinned(series)) heads.push(series)
  }

  // Gathered before anything is written: a series' seasons are found by its
  // stamp, which restoring it clears.
  const group = []
  for (const head of heads) {
    group.push(head)
    if (!isSeason(head)) group.push(...binnedWith(app, head))
  }

  const restored = unique(group)
  setDeleted(e, app, restored, "")
  return restored
}

/**
 * Removes an entry for good. A series takes every season of it that is in the
 * bin, whenever it went there, rather than leaving them behind as seasons of
 * nothing.
 */
function removeForGood(e, app, id) {
  const entry = findEntry(app, id, true)
  const group = [entry]
  if (!isSeason(entry)) {
    group.push(...app.findRecordsByFilter(COLLECTION, 'parent = {:id} && deleted != ""', "", 0, 0, { id: entry.id }))
  }
  destroy(e, app, group)
  return group.map((record) => record.id)
}

/** Removes everything in the bin for good. */
function empty(e, app) {
  const binned = app.findRecordsByFilter(COLLECTION, 'deleted != ""', "", 0, 0)
  destroy(e, app, binned)
  return binned.map((record) => record.id)
}

/**
 * Refuses a live season whose series is in the bin, for record create and
 * update requests. Binning a series takes every season it has at that moment,
 * but a second tab that has not caught up can still offer the series in its
 * "Season of" picker; saving there would leave a season in the library with
 * its series out of it, and one that a later Delete for good would not take.
 *
 * A season in the bin is left alone, so rescaling ratings can still rewrite
 * one whose series is binned too.
 */
function refuseBinnedSeries(e) {
  const record = e.record
  const parentId = record.getString("parent")
  if (!parentId || isBinned(record)) return

  let series
  try {
    series = e.app.findRecordById(COLLECTION, parentId)
  } catch {
    // A parent that does not exist is the relation field's to report.
    return
  }
  if (isBinned(series)) {
    throw new BadRequestError(`“${series.getString("title")}” is in Recently deleted. Restore it before adding seasons to it.`)
  }
}

/** Removes for good whatever has waited out RETENTION_DAYS. */
function purgeExpired(app) {
  const cutoff = new DateTime().addDate(0, 0, -RETENTION_DAYS)
  const expired = app.findRecordsByFilter(
    COLLECTION,
    'deleted != "" && deleted < {:cutoff}',
    "", 0, 0,
    { cutoff: cutoff.string() },
  )
  for (const record of seasonsFirst(expired)) app.delete(record)
  return expired.length
}

module.exports = { moveToBin, restore, removeForGood, empty, refuseBinnedSeries, purgeExpired }
