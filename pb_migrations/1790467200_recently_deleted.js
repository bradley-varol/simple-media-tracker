/// <reference path="../pb_data/types.d.ts" />

// Deleting an entry moves it to Recently deleted rather than removing it.
//
// A new `deleted` date says when an entry went, and an empty one says it is
// still in the library. The entry keeps its id, its created date and its
// season's link to its series, so restoring it puts all of that back, which
// re-creating a removed record could not: the API will not accept a created
// date. Only its updated date moves, because restoring is a change like any
// other. pb_hooks/recently-deleted.pb.js does the moving in and out, and
// removes for good anything that has waited 30 days.
//
// Guests never see a deleted entry. Like the hidden flag, that belongs in the
// read rule rather than the interface, or the bin would be one curl away. The
// owner reads everything, which is how Settings can list what is in the bin.
//
// The bin also has to be the only way out of the library, or it is a safety
// net with a hole in it. So the plain records API can no longer set the stamp
// or delete a record: a request carrying `deleted` fails the write rule, and
// the delete rule is closed to everyone but superusers. The Recently deleted
// routes still work because they write through the app rather than the API,
// and check the update rule for themselves. Seasons are still never cascaded
// by PocketBase, as the init migration explains; the routes are where a series
// and its seasons now move together, in place of the browser deleting them one
// at a time.

const OLD_READ_RULE = '@request.auth.id != "" || (@collection.app_settings.guestViewing = true && hidden = false && @collection.app_settings.guestHiddenTypes:each != type)'

const READ_RULE = '@request.auth.id != "" || (@collection.app_settings.guestViewing = true && hidden = false && deleted = "" && @collection.app_settings.guestHiddenTypes:each != type)'

const OLD_WRITE_RULE = '@request.auth.id != ""'

const WRITE_RULE = '@request.auth.id != "" && @request.body.deleted:isset = false'

migrate((app) => {
  // The field first: the rules refer to it, and PocketBase checks a rule
  // against the schema when the collection is saved.
  const media = app.findCollectionByNameOrId("media_entries")
  media.fields.add(new DateField({ name: "deleted", required: false }))
  // Both the guest rule and the purge filter on it.
  media.indexes = [
    ...media.indexes,
    "CREATE INDEX idx_media_entries_deleted ON media_entries (deleted)",
  ]
  app.save(media)

  media.listRule = READ_RULE
  media.viewRule = READ_RULE
  media.createRule = WRITE_RULE
  media.updateRule = WRITE_RULE
  media.deleteRule = null
  app.save(media)
}, (app) => {
  // Anything still in the bin comes back into the library once the field that
  // marks it is gone. That is deliberate: it can be deleted again by hand,
  // whereas removing it here would take away the last chance to restore it.
  //
  // The rules first, for the same reason as on the way up in reverse: the
  // field cannot go while a rule still names it.
  const media = app.findCollectionByNameOrId("media_entries")
  media.listRule = OLD_READ_RULE
  media.viewRule = OLD_READ_RULE
  media.createRule = OLD_WRITE_RULE
  media.updateRule = OLD_WRITE_RULE
  media.deleteRule = OLD_WRITE_RULE
  media.indexes = media.indexes.filter((index) => !index.includes("idx_media_entries_deleted"))
  app.save(media)

  media.fields.removeByName("deleted")
  app.save(media)
})
