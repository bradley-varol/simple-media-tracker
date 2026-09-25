/// <reference path="../pb_data/types.d.ts" />

// Whether entries carry a completion date at all, replacing the switch that
// only hid the calendar.
//
// The calendar was the smaller half of one question. A library that never fills
// a finish date also carries an empty date column on every row, an optional
// date field in every entry dialog, and a "Date finished" sort that orders by
// nothing — and then an empty calendar at the end of it. One switch turns off
// the field and everything drawn from it, the calendar included.
//
// Nothing stored is thrown away when it goes off. A date is a fact rather than
// a judgement, unlike a rating, which the scale settings do convert: the column
// stops being drawn, and starts again with its dates intact if the switch comes
// back on.
//
// Every instance starts with dates on, including one that had the calendar
// switched off. The two settings ask different questions — dating entries for
// the record and the sort is not the same as wanting a month view — so carrying
// the old value across would take the date column away from someone who uses
// it. The worst this costs is a calendar to switch off once.

const SETTINGS_ID = "appsettings0001"

migrate((app) => {
  const settings = app.findCollectionByNameOrId("app_settings")

  settings.fields.add(new BoolField({ name: "finishedDatesEnabled", required: false }))
  // No API rule names calendarEnabled, so unlike guestHiddenTypes this needs no
  // ordering against the media_entries rules.
  settings.fields.removeByName("calendarEnabled")

  app.save(settings)

  // A bool column arrives NOT NULL DEFAULT FALSE, which would read as an
  // upgrade quietly dropping the date field.
  const record = app.findRecordById("app_settings", SETTINGS_ID)
  record.set("finishedDatesEnabled", true)
  app.save(record)
}, (app) => {
  const settings = app.findCollectionByNameOrId("app_settings")

  settings.fields.add(new BoolField({ name: "calendarEnabled", required: false }))
  settings.fields.removeByName("finishedDatesEnabled")

  app.save(settings)

  // On for the same reason, and because it was on for everyone this migration
  // ran against: a downgrade should not land with the page missing.
  const record = app.findRecordById("app_settings", SETTINGS_ID)
  record.set("calendarEnabled", true)
  app.save(record)
})
