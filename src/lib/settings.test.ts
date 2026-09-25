import { describe, expect, it } from "vitest"
import type { MediaType } from "@/types/media"
import {
  convertRating,
  DEFAULT_SETTINGS,
  DEFAULT_SITE_TITLE,
  hiddenFromGuests,
  isExceptional,
  maxRating,
  normalizeSettings,
  normalizeSiteTitle,
  rescaleNeeded,
  SITE_TITLE_MAX_LENGTH,
  typesVisibleTo,
  type AppSettings,
} from "@/types/settings"

const five: AppSettings = { ...DEFAULT_SETTINGS, ratingScale: 5, exceptionalEnabled: true }
const ten: AppSettings = { ...DEFAULT_SETTINGS, ratingScale: 10, exceptionalEnabled: true }
const fivePlain: AppSettings = { ...five, exceptionalEnabled: false }

describe("rating scale", () => {
  it("counts the exceptional star in the maximum only when it is offered", () => {
    expect(maxRating(five)).toBe(6)
    expect(maxRating(fivePlain)).toBe(5)
    expect(maxRating(ten)).toBe(11)
  })

  it("treats only a rating above the scale as exceptional", () => {
    expect(isExceptional(6, five)).toBe(true)
    expect(isExceptional(5, five)).toBe(false)
    expect(isExceptional(6, fivePlain)).toBe(false)
    expect(isExceptional(null, five)).toBe(false)
  })
})

describe("converting ratings between scales", () => {
  it("doubles a five star rating onto a ten star scale", () => {
    expect([1, 2, 3, 4, 5].map((r) => convertRating(r, five, ten))).toEqual([2, 4, 6, 8, 10])
  })

  it("keeps an exceptional rating exceptional", () => {
    expect(convertRating(6, five, ten)).toBe(11)
    expect(convertRating(11, ten, five)).toBe(6)
  })

  it("lands an exceptional rating on the new top when the extra star is switched off", () => {
    expect(convertRating(6, five, fivePlain)).toBe(5)
    expect(convertRating(11, ten, fivePlain)).toBe(5)
  })

  it("halves a ten star rating without ever falling below one star", () => {
    expect([1, 2, 5, 7, 10].map((r) => convertRating(r, ten, five))).toEqual([1, 1, 3, 4, 5])
  })

  it("never exceeds the new scale for a non-exceptional rating", () => {
    for (let rating = 1; rating <= 10; rating += 1) {
      expect(convertRating(rating, ten, five)).toBeLessThanOrEqual(5)
      expect(convertRating(rating, ten, five)).toBeGreaterThanOrEqual(1)
    }
  })

  it("is a no-op when the scale has not moved", () => {
    for (let rating = 1; rating <= 6; rating += 1) {
      expect(convertRating(rating, five, five)).toBe(rating)
    }
  })

  it("only reports a rescale when the scale or the extra star changes", () => {
    expect(rescaleNeeded(five, five)).toBe(false)
    expect(rescaleNeeded(five, { ...five, finishedDatesEnabled: false })).toBe(false)
    expect(rescaleNeeded(five, ten)).toBe(true)
    expect(rescaleNeeded(five, fivePlain)).toBe(true)
  })
})

describe("reading stored settings", () => {
  it("falls back to the defaults for missing or unusable values", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ ratingScale: 7 as never }).ratingScale).toBe(5)
    expect(normalizeSettings({ enabledTypes: [] }).enabledTypes).toEqual(DEFAULT_SETTINGS.enabledTypes)
  })

  it("drops unknown types and never leaves the library with none", () => {
    expect(normalizeSettings({ enabledTypes: ["movie", "nonsense" as never] }).enabledTypes).toEqual(["movie"])
    expect(normalizeSettings({ enabledTypes: ["nonsense" as never] }).enabledTypes).toEqual(DEFAULT_SETTINGS.enabledTypes)
  })

  it("keeps anime and manga off unless they were stored as on", () => {
    expect(normalizeSettings(null).enabledTypes).not.toContain("anime")
    expect(normalizeSettings({ enabledTypes: ["movie", "anime"] }).enabledTypes).toEqual(["movie", "anime"])
  })
})

describe("guest viewing", () => {
  it("defaults to on, so an existing instance keeps behaving as it did", () => {
    expect(DEFAULT_SETTINGS.guestViewing).toBe(true)
    expect(normalizeSettings(null).guestViewing).toBe(true)
    expect(normalizeSettings({}).guestViewing).toBe(true)
  })

  it("is read back as stored", () => {
    expect(normalizeSettings({ guestViewing: false }).guestViewing).toBe(false)
    expect(normalizeSettings({ guestViewing: true }).guestViewing).toBe(true)
  })

  it("is not a rating setting, so changing it never rescales", () => {
    const on = { ...DEFAULT_SETTINGS, guestViewing: true }
    const off = { ...DEFAULT_SETTINGS, guestViewing: false }
    expect(rescaleNeeded(on, off)).toBe(false)
  })
})

describe("types hidden from guests", () => {
  const types = (...list: MediaType[]) => list

  it("hides nothing by default, so an upgraded instance shows guests what it did", () => {
    expect(DEFAULT_SETTINGS.guestHiddenTypes).toEqual([])
    expect(normalizeSettings(null).guestHiddenTypes).toEqual([])
    expect(normalizeSettings({}).guestHiddenTypes).toEqual([])
  })

  it("reads the stored list back in type order, dropping anything unknown", () => {
    expect(normalizeSettings({ guestHiddenTypes: types("game", "movie") }).guestHiddenTypes).toEqual(["movie", "game"])
    expect(normalizeSettings({ guestHiddenTypes: ["nonsense" as never, "book"] }).guestHiddenTypes).toEqual(["book"])
    expect(normalizeSettings({ guestHiddenTypes: "game" as never }).guestHiddenTypes).toEqual([])
  })

  it("takes the hidden types out of a guest's tabs and nobody else's", () => {
    const settings = { ...DEFAULT_SETTINGS, enabledTypes: types("movie", "game", "book"), guestHiddenTypes: types("game") }
    expect(typesVisibleTo(settings, true)).toEqual(["movie", "game", "book"])
    expect(typesVisibleTo(settings, false)).toEqual(["movie", "book"])
  })

  it("never resurfaces a switched-off type just because it is also hidden from guests", () => {
    const settings = { ...DEFAULT_SETTINGS, enabledTypes: types("movie"), guestHiddenTypes: types("game") }
    expect(typesVisibleTo(settings, true)).toEqual(["movie"])
    expect(typesVisibleTo(settings, false)).toEqual(["movie"])
  })

  it("counts an entry as hidden from guests on its own account or its type's", () => {
    const settings = { ...DEFAULT_SETTINGS, guestHiddenTypes: types("game") }
    expect(hiddenFromGuests({ type: "game", hidden: false }, settings)).toBe(true)
    expect(hiddenFromGuests({ type: "movie", hidden: true }, settings)).toBe(true)
    expect(hiddenFromGuests({ type: "movie", hidden: false }, settings)).toBe(false)
  })

  it("is not a rating setting, so changing it never rescales", () => {
    expect(rescaleNeeded(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, guestHiddenTypes: types("game") })).toBe(false)
  })
})

describe("the library name", () => {
  it("keeps a name the owner typed, without the surrounding whitespace", () => {
    expect(normalizeSiteTitle("Brad's Library")).toBe("Brad's Library")
    expect(normalizeSiteTitle("  Brad's Library  ")).toBe("Brad's Library")
  })

  it("falls back to the default rather than rendering an empty header", () => {
    expect(normalizeSiteTitle("")).toBe(DEFAULT_SITE_TITLE)
    expect(normalizeSiteTitle("   ")).toBe(DEFAULT_SITE_TITLE)
    expect(normalizeSiteTitle(null)).toBe(DEFAULT_SITE_TITLE)
    expect(normalizeSiteTitle(42)).toBe(DEFAULT_SITE_TITLE)
  })

  it("cuts a name longer than the header can hold, without a trailing space", () => {
    const long = "a".repeat(SITE_TITLE_MAX_LENGTH + 10)
    expect(normalizeSiteTitle(long)).toHaveLength(SITE_TITLE_MAX_LENGTH)
    expect(normalizeSiteTitle(`${"b".repeat(SITE_TITLE_MAX_LENGTH - 1)} tail`)).toBe("b".repeat(SITE_TITLE_MAX_LENGTH - 1))
  })

  it("comes back from stored settings, defaulting for an instance that predates it", () => {
    expect(normalizeSettings({ siteTitle: "Shelf" }).siteTitle).toBe("Shelf")
    expect(normalizeSettings({}).siteTitle).toBe(DEFAULT_SITE_TITLE)
    expect(normalizeSettings(null).siteTitle).toBe(DEFAULT_SITE_TITLE)
  })

  it("is not a rating setting, so renaming never rescales", () => {
    expect(rescaleNeeded(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, siteTitle: "Shelf" })).toBe(false)
  })
})
