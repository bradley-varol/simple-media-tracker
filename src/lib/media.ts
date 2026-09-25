import type { MediaEntry, MediaStatus, MediaType } from "@/types/media"

export type MediaTab = "all" | MediaType
export type StatusFilter = "all" | MediaStatus
export type SortOrder = "title" | "completed" | "rating" | "rating-asc"

/**
 * A series together with its seasons. Standalone entries are a group with no
 * seasons, so the list can render everything through one shape.
 */
export type EntryGroup = {
  entry: MediaEntry
  seasons: MediaEntry[]
  /** Whether the series itself matches, rather than riding in on a season. */
  matched: boolean
  /**
   * Seasons matching the current filters: the only ones the list shows, so a
   * status filter never opens a group onto seasons it excluded.
   */
  matchedSeasons: MediaEntry[]
  /**
   * The date this series takes from its seasons, or null when it has none to
   * take. See inheritedSeasonDate: it is shown and sorted by, never stored.
   */
  inheritedDate: string | null
}

export function formatDate(value: string | null): string {
  if (!value) return "—"
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function matchesFilters(
  entry: MediaEntry,
  tab: MediaTab,
  status: StatusFilter,
  search: string,
): boolean {
  return (tab === "all" || entry.type === tab)
    && (status === "all" || entry.status === status)
    && (!search || entry.title.toLocaleLowerCase().includes(search))
}

/** The fields the sort reads, so a group can stand in for an entry. */
type Sortable = Pick<MediaEntry, "title" | "rating"> & { dateFinished: string | null }

// Numeric collation so "S2" sorts before "S10", and "Rocky 2" before "Rocky 10".
function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

function compareEntries(a: Sortable, b: Sortable, sort: SortOrder): number {
  if (sort === "completed") {
    // Undated entries have to compare equal to each other, or the comparator
    // claims both "a after b" and "b after a" and the title tiebreak below
    // never runs for them.
    if (!a.dateFinished && !b.dateFinished) return compareTitles(a.title, b.title)
    if (!a.dateFinished) return 1
    if (!b.dateFinished) return -1
    return b.dateFinished.localeCompare(a.dateFinished) || compareTitles(a.title, b.title)
  }
  if (sort === "rating" || sort === "rating-asc") {
    // Unrated entries sink below every rating in both directions, for the same
    // reason undated ones do above: they compare equal to each other so the
    // title decides. Lowest first is asking for the worst rated, not the blanks.
    if (!a.rating && !b.rating) return compareTitles(a.title, b.title)
    if (!a.rating) return 1
    if (!b.rating) return -1
    const byRating = sort === "rating" ? b.rating - a.rating : a.rating - b.rating
    return byRating || compareTitles(a.title, b.title)
  }
  return compareTitles(a.title, b.title)
}

export function filterEntries(
  entries: MediaEntry[],
  tab: MediaTab,
  status: StatusFilter,
  query: string,
  sort: SortOrder,
): MediaEntry[] {
  const search = query.trim().toLocaleLowerCase()
  return entries
    .filter((entry) => matchesFilters(entry, tab, status, search))
    .sort((a, b) => compareEntries(a, b, sort))
}

/**
 * Entries that stand on their own in the library: everything except seasons.
 * A season whose series is missing is promoted rather than hidden, so a broken
 * link can never make an entry disappear.
 */
export function topLevelEntries(entries: MediaEntry[]): MediaEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  return entries.filter((entry) => !entry.parent || !byId.has(entry.parent))
}

/**
 * The completion date a series takes from its seasons: the latest dated season,
 * and only when the series is completed and carries no date of its own.
 *
 * It is derived at read time rather than written to the entry. A date the user
 * set themselves is theirs and always wins, and a series still in progress has
 * no completion date to show — its latest season says when it was last watched,
 * which is a different fact from when the series was finished.
 */
export function inheritedSeasonDate(entry: MediaEntry, seasons: MediaEntry[]): string | null {
  if (entry.dateFinished || entry.status !== "completed") return null
  let latest: string | null = null
  // yyyy-mm-dd compares chronologically as a string, which normalizeEntry
  // guarantees is the only shape stored.
  for (const season of seasons) {
    if (season.dateFinished && (!latest || season.dateFinished > latest)) latest = season.dateFinished
  }
  return latest
}

export function seasonsOf(entries: MediaEntry[], seriesId: string): MediaEntry[] {
  return entries
    .filter((entry) => entry.parent === seriesId)
    // Numeric collation so "S2" sorts before "S10".
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
}

/**
 * The order a series opens onto its seasons. Rating and finish date are verdicts
 * a season has of its own, so those sorts reach inside a series too. Title keeps
 * seasons in their natural order: S1 to S10 is already the title order.
 */
function compareSeasons(a: MediaEntry, b: MediaEntry, sort: SortOrder): number {
  if (sort === "rating" || sort === "rating-asc" || sort === "completed") return compareEntries(a, b, sort)
  return compareTitles(a.title, b.title)
}

/**
 * Groups the library into series and their seasons, keeping a group when either
 * the series or any of its seasons matches — so searching a season title
 * surfaces the series it belongs to instead of nothing.
 */
export function groupEntries(
  entries: MediaEntry[],
  tab: MediaTab,
  status: StatusFilter,
  query: string,
  sort: SortOrder,
): EntryGroup[] {
  const search = query.trim().toLocaleLowerCase()

  const seasonsByParent = new Map<string, MediaEntry[]>()
  for (const entry of entries) {
    if (!entry.parent) continue
    const existing = seasonsByParent.get(entry.parent)
    if (existing) existing.push(entry)
    else seasonsByParent.set(entry.parent, [entry])
  }

  return topLevelEntries(entries)
    .map((entry) => {
      const seasons = (seasonsByParent.get(entry.id) ?? [])
        .slice()
        .sort((a, b) => compareSeasons(a, b, sort))
      return {
        entry,
        seasons,
        matched: matchesFilters(entry, tab, status, search),
        matchedSeasons: seasons.filter((season) => matchesFilters(season, tab, status, search)),
        inheritedDate: inheritedSeasonDate(entry, seasons),
      }
    })
    .filter((group) => group.matched || group.matchedSeasons.length > 0)
    // A completed series sorts on the date it inherits, so one whose seasons
    // carry the dates does not sink below everything dated.
    .sort((a, b) => compareEntries(
      { ...a.entry, dateFinished: a.entry.dateFinished ?? a.inheritedDate },
      { ...b.entry, dateFinished: b.entry.dateFinished ?? b.inheritedDate },
      sort,
    ))
}

/**
 * Candidates for a season's series: top-level entries of the same type, never
 * the entry itself, and never one that already has seasons of its own beyond
 * the nesting depth the model allows.
 */
export function parentCandidates(entries: MediaEntry[], type: MediaType, excludeId?: string): MediaEntry[] {
  return entries
    .filter((entry) => entry.type === type && !entry.parent && entry.id !== excludeId)
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * The rows the "Season of" picker shows, in the order it shows them.
 *
 * Searching narrows it to series: the rows standing for the current choice are
 * only in the way once a name is being typed. `create` comes last so a name
 * that partly matches an existing series still offers that series first, and it
 * doubles as the empty state — a search that matches nothing always has it to
 * show, so the list is never empty.
 */
export type ParentPickerRows = {
  /** The unsaved series named in the field, when it is worth showing. */
  pending: string | null
  /** The "Not a season" row. */
  none: boolean
  series: MediaEntry[]
  /** The title to offer creating, or null when the name is already taken. */
  create: string | null
}

export function parentPickerRows(
  options: MediaEntry[],
  pending: string | null,
  search: string,
): ParentPickerRows {
  const typed = search.trim()
  const query = typed.toLocaleLowerCase()
  const matches = (title: string) => title.toLocaleLowerCase().includes(query)
  const isQuery = (title: string) => title.toLocaleLowerCase() === query

  if (!typed) return { pending, none: true, series: options, create: null }

  return {
    pending: pending && matches(pending) ? pending : null,
    none: false,
    series: options.filter((option) => matches(option.title)),
    // An exact match is the series they mean, so offer picking it rather than a
    // second one under the same title.
    create: options.some((option) => isQuery(option.title)) || (pending && isQuery(pending))
      ? null
      : typed,
  }
}

/**
 * How long Recently deleted keeps an entry before it goes for good. The server
 * does the removing, so this only drives the countdown and has to match
 * RETENTION_DAYS in pb_hooks/recently-deleted.js.
 */
export const BIN_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * One row of Recently deleted: an entry together with what a Restore on it
 * brings back.
 */
export type BinGroup = {
  entry: MediaEntry
  /** Seasons that went into the bin with this series, and come back with it. */
  seasons: MediaEntry[]
  /**
   * The series a season deleted on its own belongs to, whether it is in the
   * library or in the bin too. Null for anything that is not a season.
   */
  series: MediaEntry | null
}

/**
 * Groups the bin into the rows Recently deleted shows, most recently deleted
 * first.
 *
 * A series and the seasons deleted with it share one stamp, and that is what
 * holds them together here as it does on the server: a season deleted on its
 * own before its series keeps an earlier stamp, so it stays a row of its own
 * rather than coming back with a series it had already been taken out of.
 */
export function binGroups(binned: MediaEntry[], library: MediaEntry[]): BinGroup[] {
  const byId = new Map([...library, ...binned].map((entry) => [entry.id, entry]))

  const deletedWith = (entry: MediaEntry): MediaEntry | null => {
    const series = entry.parent ? byId.get(entry.parent) : undefined
    return series?.deleted && series.deleted === entry.deleted ? series : null
  }

  const groups = new Map<string, BinGroup>()
  for (const entry of binned) {
    if (deletedWith(entry)) continue
    groups.set(entry.id, { entry, seasons: [], series: entry.parent ? byId.get(entry.parent) ?? null : null })
  }
  for (const entry of binned) {
    const series = deletedWith(entry)
    if (series) groups.get(series.id)?.seasons.push(entry)
  }

  for (const group of groups.values()) {
    group.seasons.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
  }

  // The stamps are UTC in one fixed format, so they order as strings.
  return [...groups.values()].sort((a, b) =>
    (b.entry.deleted ?? "").localeCompare(a.entry.deleted ?? "") || a.entry.title.localeCompare(b.entry.title))
}

/**
 * Every season of a series that is in the bin, whenever it went there. Removing
 * the series for good takes all of them, so none is left behind as a season of
 * nothing.
 */
export function binnedSeasonsOf(binned: MediaEntry[], seriesId: string): MediaEntry[] {
  return binned.filter((entry) => entry.parent === seriesId)
}

/** PocketBase writes a space where Date.parse wants a T. */
function parseStamp(stamp: string): number {
  return Date.parse(stamp.replace(" ", "T"))
}

/** "Deleted today", "Deleted yesterday", "Deleted 4 days ago", by the viewer's calendar. */
export function deletedLabel(deleted: string, now: Date): string {
  const then = new Date(parseStamp(deleted))
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.max(0, Math.round((startOf(now) - startOf(then)) / DAY_MS))
  if (days === 0) return "Deleted today"
  if (days === 1) return "Deleted yesterday"
  return `Deleted ${days} days ago`
}

/**
 * How long until an entry goes for good. Rounded up, so a fresh deletion reads
 * as the full 30 days. The purge runs hourly, so one past its time is gone
 * within the hour.
 */
export function timeLeftLabel(deleted: string, now: Date): string {
  const left = parseStamp(deleted) + BIN_DAYS * DAY_MS - now.getTime()
  if (left <= 0) return "Going within the hour"
  const days = Math.ceil(left / DAY_MS)
  return days === 1 ? "1 day left" : `${days} days left`
}
