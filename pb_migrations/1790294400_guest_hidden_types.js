/// <reference path="../pb_data/types.d.ts" />

// Whole media types hidden from guests, beside the per-entry hidden flag.
//
// Like that flag and the public viewing switch, this has to reach the API rule
// rather than stop at the interface: a type the frontend declines to draw is
// still one request away for anyone with curl. The rule below joins the list
// from app_settings and refuses a guest any entry whose type is in it.
//
// `:each != type` reads "every listed type differs from this entry's". Rules
// compare a multi-valued left side with all-of semantics unless the operator
// is prefixed with `?`, and an empty list satisfies a negative comparison, so
// an instance that hides nothing behaves exactly as it did before this ran.
//
// The list is a multiple select rather than a json column like enabledTypes:
// `:each` only takes select, file and relation fields apart, and on a json
// value it is silently dropped, leaving a comparison against the whole array
// that every entry passes. The values are the same six as media_entries.type,
// and a new type has to be added to both.

const SETTINGS_ID = "appsettings0001"

// Matches the values of media_entries.type in 1789948800_init.js.
const MEDIA_TYPES = ["movie", "show", "game", "book", "anime", "manga"]

const OLD_READ_RULE = '@request.auth.id != "" || (@collection.app_settings.guestViewing = true && hidden = false)'

const READ_RULE = '@request.auth.id != "" || (@collection.app_settings.guestViewing = true && hidden = false && @collection.app_settings.guestHiddenTypes:each != type)'

migrate((app) => {
  // The field first: the rule refers to it, and PocketBase checks a rule
  // against the schema when the collection is saved.
  const settings = app.findCollectionByNameOrId("app_settings")
  settings.fields.add(new SelectField({
    name: "guestHiddenTypes",
    required: false,
    maxSelect: MEDIA_TYPES.length,
    values: MEDIA_TYPES,
  }))
  app.save(settings)

  // Nothing hidden to begin with, so an upgraded instance shows guests what it
  // always did.
  const record = app.findRecordById("app_settings", SETTINGS_ID)
  record.set("guestHiddenTypes", [])
  app.save(record)

  const media = app.findCollectionByNameOrId("media_entries")
  media.listRule = READ_RULE
  media.viewRule = READ_RULE
  app.save(media)
}, (app) => {
  // The rule first, for the same reason in reverse: the field cannot go while
  // a rule still names it.
  const media = app.findCollectionByNameOrId("media_entries")
  media.listRule = OLD_READ_RULE
  media.viewRule = OLD_READ_RULE
  app.save(media)

  const settings = app.findCollectionByNameOrId("app_settings")
  settings.fields.removeByName("guestHiddenTypes")
  app.save(settings)
})
