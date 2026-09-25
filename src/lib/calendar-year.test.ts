import { describe, expect, it } from "vitest"
import { entriesByMonth } from "@/components/calendar-year"
import type { MediaEntry } from "@/types/media"

function entry(id: string, title: string, dateFinished: string | null): MediaEntry {
  return {
    id,
    type: "game",
    title,
    status: "completed",
    dateFinished,
    rating: null,
    hidden: false,
    parent: null,
    deleted: null,
    created: "",
    updated: "",
  }
}

/** Mirrors how CalendarPage builds its byDate map. */
function byDate(entries: MediaEntry[]): Map<string, MediaEntry[]> {
  const map = new Map<string, MediaEntry[]>()
  for (const item of entries) {
    if (!item.dateFinished) continue
    const existing = map.get(item.dateFinished)
    if (existing) existing.push(item)
    else map.set(item.dateFinished, [item])
  }
  return map
}

const library = [
  entry("c", "Charlie", "2025-03-20"),
  entry("a", "Alpha", "2025-03-04"),
  entry("b", "Bravo", "2025-01-15"),
  entry("d", "Delta", "2024-03-01"),
  entry("e", "Echo", "2025-12-31"),
  entry("f", "Foxtrot", null),
]

describe("year view bucketing", () => {
  it("always returns twelve months, so an empty month still gets a row", () => {
    expect(entriesByMonth(byDate(library), 2025)).toHaveLength(12)
    expect(entriesByMonth(new Map(), 1999)).toHaveLength(12)
  })

  it("keeps only the requested year", () => {
    const months = entriesByMonth(byDate(library), 2025)
    const titles = months.flat().map((item) => item.title)
    expect(titles).toContain("Bravo")
    expect(titles).not.toContain("Delta")
  })

  it("puts entries in the right month", () => {
    const months = entriesByMonth(byDate(library), 2025)
    expect(months[0].map((item) => item.title)).toEqual(["Bravo"])
    expect(months[2].map((item) => item.title)).toEqual(["Alpha", "Charlie"])
    expect(months[11].map((item) => item.title)).toEqual(["Echo"])
    expect(months[6]).toEqual([])
  })

  it("orders a month chronologically, not alphabetically", () => {
    // Charlie comes first alphabetically but was finished later.
    expect(entriesByMonth(byDate(library), 2025)[2].map((item) => item.title)).toEqual(["Alpha", "Charlie"])
  })

  it("falls back to title order for two entries finished the same day", () => {
    const sameDay = [entry("y", "Zulu", "2025-05-05"), entry("x", "Alpha", "2025-05-05")]
    expect(entriesByMonth(byDate(sameDay), 2025)[4].map((item) => item.title)).toEqual(["Alpha", "Zulu"])
  })

  it("leaves out entries with no completion date", () => {
    const months = entriesByMonth(byDate(library), 2025)
    expect(months.flat().map((item) => item.title)).not.toContain("Foxtrot")
  })

  it("handles the boundary months without spilling into a neighbouring year", () => {
    const edges = [entry("j", "Jan first", "2025-01-01"), entry("d", "Dec last", "2025-12-31")]
    const months = entriesByMonth(byDate(edges), 2025)
    expect(months[0].map((item) => item.title)).toEqual(["Jan first"])
    expect(months[11].map((item) => item.title)).toEqual(["Dec last"])
    expect(entriesByMonth(byDate(edges), 2024).flat()).toEqual([])
    expect(entriesByMonth(byDate(edges), 2026).flat()).toEqual([])
  })

  it("returns every month empty for a year with nothing in it", () => {
    expect(entriesByMonth(byDate(library), 2019).every((month) => month.length === 0)).toBe(true)
  })
})
