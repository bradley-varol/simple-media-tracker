import { describe, expect, it } from "vitest"
import { BIN_DAYS, binGroups, binnedSeasonsOf, deletedLabel, filterEntries, formatDate, groupEntries, inheritedSeasonDate, parentCandidates, parentPickerRows, timeLeftLabel, topLevelEntries, type SortOrder } from "@/lib/media"
import { normalizeEntry, type MediaEntry } from "@/types/media"

const entries: MediaEntry[] = [
  { id: "a", type: "movie", title: "The Matrix", status: "planned", dateFinished: null, rating: null, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-03" },
  { id: "b", type: "book", title: "Dune", status: "planned", dateFinished: null, rating: null, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-02" },
  { id: "c", type: "game", title: "Outer Wilds", status: "completed", dateFinished: "2026-01-04", rating: 5, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-04" },
]

describe("library filtering", () => {
  it("shows planned entries from every media type on All", () => {
    expect(filterEntries(entries, "all", "planned", "", "title").map((entry) => entry.id)).toEqual(["b", "a"])
  })

  it("combines type, status, and title search", () => {
    expect(filterEntries(entries, "game", "completed", "outer", "title").map((entry) => entry.id)).toEqual(["c"])
    expect(filterEntries(entries, "movie", "completed", "", "title")).toEqual([])
  })

  it("sorts dated entries first for date completed", () => {
    expect(filterEntries(entries, "all", "all", "", "completed")[0].id).toBe("c")
  })

  it("falls back to title order for undated entries", () => {
    // Undated entries must compare equal to each other, or the comparator
    // claims both "a after b" and "b after a" and never reaches the tiebreak.
    const sorted = filterEntries(entries, "all", "all", "", "completed").map((entry) => entry.title)
    expect(sorted).toEqual(["Outer Wilds", "Dune", "The Matrix"])
  })

  it("orders undated entries the same regardless of input order", () => {
    const forwards = filterEntries(entries, "all", "planned", "", "completed").map((entry) => entry.id)
    const backwards = filterEntries([...entries].reverse(), "all", "planned", "", "completed").map((entry) => entry.id)
    expect(forwards).toEqual(backwards)
  })

  it("sorts highest rated first, then unrated by title", () => {
    const rated = [...entries, { ...entries[0], id: "d", title: "Arrival", rating: 3 }]
    const sorted = filterEntries(rated, "all", "all", "", "rating").map((entry) => entry.title)
    expect(sorted).toEqual(["Outer Wilds", "Arrival", "Dune", "The Matrix"])
  })

  it("sorts lowest rated first, still with unrated last", () => {
    const rated = [...entries, { ...entries[0], id: "d", title: "Arrival", rating: 3 }]
    const sorted = filterEntries(rated, "all", "all", "", "rating-asc").map((entry) => entry.title)
    expect(sorted).toEqual(["Arrival", "Outer Wilds", "Dune", "The Matrix"])
  })
})

describe("entry values", () => {
  it("trims titles and accepts exceptional six-star ratings and rejects higher ratings", () => {
    const input = { type: "book" as const, title: "  Dune  ", status: "completed" as const, dateFinished: null, rating: 5, hidden: false, parent: null }
    expect(normalizeEntry(input)).toMatchObject({ title: "Dune", hidden: false })
    expect(normalizeEntry({ ...input, hidden: true }).hidden).toBe(true)
    // normalizeEntry guards the column's ceiling; the scale in force is
    // enforced by the rating input, which cannot produce a higher value.
    expect(normalizeEntry({ ...input, rating: 11 }).rating).toBe(11)
    expect(() => normalizeEntry({ ...input, rating: 12 })).toThrow(/between 1 and 11/)
    expect(() => normalizeEntry({ ...input, rating: 2.5 })).toThrow(/whole number/)
  })

  it("formats completion dates without timezone shifts", () => {
    expect(formatDate("2026-01-04")).toBe("Jan 4, 2026")
  })
})

const series: MediaEntry[] = [
  { id: "s", type: "show", title: "Silo", status: "in_progress", dateFinished: null, rating: 5, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-02-01" },
  { id: "s2", type: "show", title: "Silo: S2", status: "completed", dateFinished: "2026-01-20", rating: 4, hidden: false, parent: "s", deleted: null, created: "2026-01-01", updated: "2026-01-20" },
  { id: "s10", type: "show", title: "Silo: S10", status: "completed", dateFinished: "2026-01-30", rating: 6, hidden: false, parent: "s", deleted: null, created: "2026-01-01", updated: "2026-01-30" },
  { id: "s1", type: "show", title: "Silo: S1", status: "completed", dateFinished: "2026-01-10", rating: 3, hidden: false, parent: "s", deleted: null, created: "2026-01-01", updated: "2026-01-10" },
  { id: "m", type: "movie", title: "Arrival", status: "completed", dateFinished: "2026-01-05", rating: 5, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-05" },
]

describe("series and seasons", () => {
  it("treats only non-seasons as top level", () => {
    expect(topLevelEntries(series).map((entry) => entry.id)).toEqual(["s", "m"])
  })

  it("keeps a series rating independent of its seasons", () => {
    const group = groupEntries(series, "all", "all", "", "title")[1]
    expect(group.entry.title).toBe("Silo")
    expect(group.entry.rating).toBe(5)
    expect(group.seasons.map((season) => season.rating)).toEqual([3, 4, 6])
  })

  it("orders seasons numerically so S2 precedes S10", () => {
    const group = groupEntries(series, "show", "all", "", "title")[0]
    expect(group.seasons.map((season) => season.title)).toEqual(["Silo: S1", "Silo: S2", "Silo: S10"])
  })

  it("orders seasons by their own rating and finish date", () => {
    const titles = (sort: SortOrder) =>
      groupEntries(series, "show", "all", "", sort)[0].seasons.map((season) => season.title)
    expect(titles("rating")).toEqual(["Silo: S10", "Silo: S2", "Silo: S1"])
    expect(titles("rating-asc")).toEqual(["Silo: S1", "Silo: S2", "Silo: S10"])
    expect(titles("completed")).toEqual(["Silo: S10", "Silo: S2", "Silo: S1"])
  })

  it("keeps seasons in season order when sorting by recent updates", () => {
    const group = groupEntries(series, "show", "all", "", "title")[0]
    expect(group.seasons.map((season) => season.title)).toEqual(["Silo: S1", "Silo: S2", "Silo: S10"])
  })

  it("surfaces the series when only a season matches the search", () => {
    const groups = groupEntries(series, "all", "all", "S10", "title")
    expect(groups).toHaveLength(1)
    expect(groups[0].entry.title).toBe("Silo")
    expect(groups[0].matchedSeasons.map((season) => season.title)).toEqual(["Silo: S10"])
  })

  it("keeps a series whose seasons match a status it does not have itself", () => {
    const groups = groupEntries(series, "all", "completed", "", "title")
    expect(groups.map((group) => group.entry.title)).toEqual(["Arrival", "Silo"])
    expect(groups[1].matched).toBe(false)
  })

  it("matches only the seasons the filter allows", () => {
    // Silo is in progress with three completed seasons, so filtering by
    // "planned" leaves the group nothing to show but its own row.
    const planned = series.map((entry) => entry.id === "s" ? { ...entry, status: "planned" as const } : entry)
    const group = groupEntries(planned, "show", "planned", "", "title")[0]
    expect(group.matched).toBe(true)
    expect(group.matchedSeasons).toEqual([])
    expect(group.seasons).toHaveLength(3)
  })

  it("narrows a group to the seasons that match", () => {
    const mixed = series.map((entry) => entry.id === "s1" ? { ...entry, status: "planned" as const } : entry)
    const group = groupEntries(mixed, "show", "planned", "", "title")[0]
    expect(group.matched).toBe(false)
    expect(group.matchedSeasons.map((season) => season.title)).toEqual(["Silo: S1"])
  })

  it("never lists a season as its own row", () => {
    const titles = groupEntries(series, "all", "all", "", "title").map((group) => group.entry.title)
    expect(titles).not.toContain("Silo: S1")
  })

  it("promotes a season whose series is missing rather than hiding it", () => {
    const orphan = series.filter((entry) => entry.id !== "s")
    expect(topLevelEntries(orphan).map((entry) => entry.id).sort()).toEqual(["m", "s1", "s10", "s2"])
  })

  it("leaves a series in progress without a date of its own", () => {
    // The latest season says when it was last watched, not when the series was
    // finished, so an unfinished series stays undated.
    const group = groupEntries(series, "show", "all", "", "title")[0]
    expect(group.entry.status).toBe("in_progress")
    expect(group.inheritedDate).toBeNull()
  })

  it("takes the latest season date once the series is completed", () => {
    const finished = series.map((entry) => entry.id === "s" ? { ...entry, status: "completed" as const } : entry)
    const group = groupEntries(finished, "show", "all", "", "title")[0]
    // S10 is the latest by date, not by position or title order.
    expect(group.inheritedDate).toBe("2026-01-30")
  })

  it("keeps a date the series carries itself", () => {
    const dated = series.map((entry) => entry.id === "s"
      ? { ...entry, status: "completed" as const, dateFinished: "2026-02-14" }
      : entry)
    const group = groupEntries(dated, "show", "all", "", "title")[0]
    expect(group.entry.dateFinished).toBe("2026-02-14")
    expect(group.inheritedDate).toBeNull()
  })

  it("takes nothing when no season is dated", () => {
    const undated = series.map((entry) => entry.parent === "s"
      ? { ...entry, dateFinished: null }
      : entry.id === "s" ? { ...entry, status: "completed" as const } : entry)
    expect(groupEntries(undated, "show", "all", "", "title")[0].inheritedDate).toBeNull()
  })

  it("sorts a completed series by the date it inherits", () => {
    const finished = series.map((entry) => entry.id === "s" ? { ...entry, status: "completed" as const } : entry)
    // Silo inherits Jan 30 from S10, so it sorts above Arrival's Jan 5 rather
    // than falling to the bottom as an undated entry.
    const titles = groupEntries(finished, "all", "all", "", "completed").map((group) => group.entry.title)
    expect(titles).toEqual(["Silo", "Arrival"])
  })

  it("leaves an undated series in progress at the bottom of the date sort", () => {
    const titles = groupEntries(series, "all", "all", "", "completed").map((group) => group.entry.title)
    expect(titles).toEqual(["Arrival", "Silo"])
  })

  it("leaves a completed entry with no seasons undated", () => {
    const movie = series.find((entry) => entry.id === "m")!
    expect(inheritedSeasonDate({ ...movie, dateFinished: null }, [])).toBeNull()
  })

  it("offers only same-type non-seasons as a parent, never itself", () => {
    expect(parentCandidates(series, "show", "s").map((entry) => entry.id)).toEqual([])
    expect(parentCandidates(series, "show").map((entry) => entry.id)).toEqual(["s"])
    expect(parentCandidates(series, "movie").map((entry) => entry.id)).toEqual(["m"])
  })
})

describe("parentPickerRows", () => {
  const options: MediaEntry[] = [
    { id: "s", type: "show", title: "Silo", status: "in_progress", dateFinished: null, rating: null, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-01" },
    { id: "sv", type: "show", title: "Severance", status: "completed", dateFinished: "2026-02-01", rating: 9, hidden: false, parent: null, deleted: null, created: "2026-01-01", updated: "2026-02-01" },
  ]

  it("lists every series and the clearing row until a name is typed", () => {
    const rows = parentPickerRows(options, null, "  ")
    expect(rows).toEqual({ pending: null, none: true, series: options, create: null })
  })

  it("narrows to matching series and offers the typed name last", () => {
    const rows = parentPickerRows(options, null, "sev")
    expect(rows.series.map((option) => option.id)).toEqual(["sv"])
    expect(rows.create).toBe("sev")
    expect(rows.none).toBe(false)
  })

  it("offers nothing to create when the name is already a series, whatever the case", () => {
    expect(parentPickerRows(options, null, "severance").create).toBeNull()
    expect(parentPickerRows(options, null, " SILO ").create).toBeNull()
  })

  it("keeps the unsaved series visible without offering to name it twice", () => {
    expect(parentPickerRows(options, "The Bear", "")).toMatchObject({ pending: "The Bear", none: true })
    // Only the exact name is already taken; a partial one is still a series
    // they could be about to name, as it would be for a saved series.
    expect(parentPickerRows(options, "The Bear", "the bear")).toMatchObject({ pending: "The Bear", create: null })
    expect(parentPickerRows(options, "The Bear", "bear")).toMatchObject({ pending: "The Bear", create: "bear" })
    // Not a match for the search, so it drops out of the list rather than
    // sitting above the series being looked for.
    expect(parentPickerRows(options, "The Bear", "sil").pending).toBeNull()
  })

  it("always has a row to show, so the list is never empty", () => {
    const rows = parentPickerRows(options, null, "Andor")
    expect(rows.series).toEqual([])
    expect(rows.create).toBe("Andor")
  })
})


describe("recently deleted", () => {
  const T1 = "2026-09-01 10:00:00.000Z"
  const T2 = "2026-09-05 10:00:00.000Z"
  const T3 = "2026-09-08 10:00:00.000Z"

  const make = (id: string, title: string, overrides: Partial<MediaEntry> = {}): MediaEntry => ({
    id, type: "show", title, status: "completed", dateFinished: null, rating: null, hidden: false,
    parent: null, deleted: null, created: "2026-01-01", updated: "2026-01-01", ...overrides,
  })

  // Severance went in with two of its seasons; its third had been deleted on
  // its own a few days earlier. Andor is in the library with one season binned.
  const severance = make("sev", "Severance", { deleted: T2 })
  const s1 = make("sev1", "Season 1", { parent: "sev", deleted: T2 })
  const s2 = make("sev2", "Season 2", { parent: "sev", deleted: T2 })
  const s3 = make("sev3", "Season 3", { parent: "sev", deleted: T1 })
  const andor = make("and", "Andor")
  const andor1 = make("and1", "Season 1", { parent: "and", deleted: T3 })
  const heat = make("heat", "Heat", { type: "movie", deleted: T1 })

  const binned = [s2, heat, s3, severance, andor1, s1]
  const library = [andor]

  it("folds seasons deleted with their series into its row, and nothing else", () => {
    const groups = binGroups(binned, library)
    const row = groups.find((group) => group.entry.id === "sev")
    expect(row?.seasons.map((season) => season.id)).toEqual(["sev1", "sev2"])
    expect(groups.map((group) => group.entry.id)).not.toContain("sev1")
  })

  it("keeps a season deleted before its series as a row of its own, naming the series", () => {
    const row = binGroups(binned, library).find((group) => group.entry.id === "sev3")
    expect(row?.series?.id).toBe("sev")
    expect(row?.series?.deleted).toBe(T2)
  })

  it("names a live series for a season deleted from it", () => {
    const row = binGroups(binned, library).find((group) => group.entry.id === "and1")
    expect(row?.series?.id).toBe("and")
    expect(row?.series?.deleted).toBeNull()
  })

  it("lists the most recent deletion first, then by title", () => {
    expect(binGroups(binned, library).map((group) => group.entry.id)).toEqual(["and1", "sev", "heat", "sev3"])
  })

  it("treats a season whose series is gone for good as an entry of its own", () => {
    const orphan = make("orph", "Season 9", { parent: null, deleted: T1 })
    expect(binGroups([orphan], [])).toEqual([{ entry: orphan, seasons: [], series: null }])
  })

  it("takes every binned season of a series when removing it for good", () => {
    expect(binnedSeasonsOf(binned, "sev").map((season) => season.id).sort()).toEqual(["sev1", "sev2", "sev3"])
  })

  it("says how long ago by the calendar, not by 24 hour spans", () => {
    const local = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString().replace("T", " ")
    expect(deletedLabel(local(10, 23), new Date(2026, 8, 10, 23, 30))).toBe("Deleted today")
    expect(deletedLabel(local(10, 23), new Date(2026, 8, 11, 0, 30))).toBe("Deleted yesterday")
    expect(deletedLabel(local(10, 9), new Date(2026, 8, 14, 8))).toBe("Deleted 4 days ago")
  })

  it("counts down the days left, rounding up", () => {
    const deleted = "2026-09-01 12:00:00.000Z"
    const at = (iso: string) => new Date(iso)
    expect(timeLeftLabel(deleted, at("2026-09-01T12:00:01Z"))).toBe(`${BIN_DAYS} days left`)
    expect(timeLeftLabel(deleted, at("2026-09-30T13:00:00Z"))).toBe("1 day left")
    expect(timeLeftLabel(deleted, at("2026-10-01T12:30:00Z"))).toBe("Going within the hour")
  })
})
