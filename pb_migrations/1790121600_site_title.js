/// <reference path="../pb_data/types.d.ts" />

// The name in the header. It lives beside the other settings rather than in the
// bundle because it is what a visitor sees the library called, and the owner
// should be able to change it without a rebuild.
//
// app_settings is world readable, so a guest gets the title with the same
// request that tells them which tabs to draw.
const SETTINGS_ID = "appsettings0001"

// Kept short on purpose: it sits next to the tabs in a single header row, and a
// title long enough to crowd them out is a worse default than a truncated one.
const SITE_TITLE_MAX = 40

// Matches DEFAULT_SITE_TITLE in src/types/settings.ts. The trailing period is
// drawn by the header rather than stored, so it is not part of this.
const DEFAULT_SITE_TITLE = "media"

migrate((app) => {
  const settings = app.findCollectionByNameOrId("app_settings")

  settings.fields.add(new TextField({ name: "siteTitle", required: false, max: SITE_TITLE_MAX }))

  app.save(settings)

  // Existing installs keep the name they have always shown; an empty column
  // would otherwise read as "no title" and fall back on every page load.
  const record = app.findRecordById("app_settings", SETTINGS_ID)
  record.set("siteTitle", DEFAULT_SITE_TITLE)
  app.save(record)
}, (app) => {
  const settings = app.findCollectionByNameOrId("app_settings")

  settings.fields.removeByName("siteTitle")

  app.save(settings)
})
